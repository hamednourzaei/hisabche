// ============================================
// backend/src/services/payroll/attendance-link.service.ts
//
// An employee's own attendance, behind a link their manager gives them
// (docs/attendance-self-01-migration.sql).
//
// ⚠️ THE LINK IS ITS MAKER, NARROWED TO ONE EMPLOYEE — the same rule as the
// customer portal. Each visit resolves the maker's membership exactly as a
// request would (resolveWorkspaceAccess) and requires the role the attendance
// sheet itself requires. A manager removed from the workspace takes their
// links with them.
//
// ⚠️ WHAT THE EMPLOYEE SENDS IS A SUBMISSION, NOT A RECORD. It becomes a record
// at once only when the link allows it AND nobody has recorded that day; in
// every other case a manager decides. Those three writes are Postgres
// functions (supabase-js has no transactions).
//
// ⚠️ THE PUBLIC VIEW IS A CLOSED LIST. Name, position, the business name and
// this person's own days. No salary, phone, id number, or anybody else.
//
// ⚠️ «TODAY» AND «NOW» ARE THE LINK'S ZONE ON THE SERVER'S CLOCK — never the
// employee's device. The zone was fixed by the manager's device when the link
// was made, which is the «shop's own local time» the sheet already records in.
//
// Nothing here touches payroll.
// ============================================

import { randomBytes } from 'node:crypto'

import { supabase } from '../../db'
import { ConflictError, DatabaseError, NotFoundError } from '../../errors/database.error'
import { ValidationError } from '../../errors/validation.error'
import { BaseError } from '../../errors/base.error'
import { selectAllPages } from '../../utils/fetch-all-pages'
import { resolveWorkspaceAccess } from '../authorization/workspace-access.service'
import { isMissingSchema } from '../blog/blog.domain'
import { minutesOf } from '../customers/attendance.domain'
import { requireRole, type TenancyContext } from '../tenancy.service'
import {
  addDays,
  isIanaTimeZone,
  isoDayIn,
  linkState,
  normalizeClock,
  type AttendanceLinkState,
} from './attendance-link.domain'

/** attendance-self-01 has not been run. The sheet itself keeps working. */
export class AttendanceSelfNotConfiguredError extends BaseError {
  constructor() {
    super('ATTENDANCE_SELF_NOT_CONFIGURED', 503)
    this.name = 'AttendanceSelfNotConfiguredError'
  }
}

/** What an employee may say about a day. `holiday` is the business's to declare. */
export const SELF_STATUSES = ['present', 'absent', 'leave'] as const
export type SelfStatus = (typeof SELF_STATUSES)[number]

export const MAX_DAYS_BACK = 7

interface LinkRow {
  id: string
  workspace_id: string
  employee_id: string
  token: string
  created_by: string
  created_at: string
  expires_at: string | null
  last_used_at: string | null
  revoked_at: string | null
  days_back: number
  auto_apply: boolean
  time_zone: string
}
const LINK_COLUMNS =
  'id, workspace_id, employee_id, token, created_by, created_at, expires_at, last_used_at, revoked_at, days_back, auto_apply, time_zone'

export interface AttendanceLink {
  id: string
  employeeId: string
  token: string
  state: AttendanceLinkState
  createdAt: string
  expiresAt: string | null
  lastUsedAt: string | null
  daysBack: number
  autoApply: boolean
  timeZone: string
}

interface SubmissionRow {
  id: string
  employee_id: string
  date: string
  status: string
  check_in: string | null
  check_out: string | null
  note: string | null
  received_at: string
  state: string
  decision_note: string | null
}
const SUBMISSION_COLUMNS =
  'id, employee_id, date, status, check_in, check_out, note, received_at, state, decision_note'

export interface AttendanceSubmission {
  id: string
  employeeId: string
  date: string
  status: SelfStatus
  checkIn: string | null
  checkOut: string | null
  note: string | null
  /** The server's clock when it arrived. */
  receivedAt: string
  state: 'pending' | 'applied' | 'approved' | 'rejected'
  decisionNote: string | null
}

/** The closed list a link holder sees. Adding a field here is a decision. */
export interface AttendanceSelfView {
  businessName: string | null
  employeeName: string
  position: string | null
  timeZone: string
  today: string
  /** `HH:MM` in `timeZone`, from the server. */
  now: string
  allowedFrom: string
  allowedTo: string
  autoApply: boolean
  days: Array<{
    date: string
    record: null | { status: string; checkIn: string | null; checkOut: string | null }
    submissions: Array<Omit<AttendanceSubmission, 'employeeId' | 'date'>>
  }>
}

export interface SelfSubmitInput {
  date: string
  status: string
  checkIn: string | null
  checkOut: string | null
  note: string | null
  clientRequestId: string
}

const hhmm = (value: string | null | undefined) => (value ? String(value).slice(0, 5) : null)

type DbError = { code?: string; message?: string } | null

function check(error: DbError, what: string): void {
  if (!error) return
  if (isMissingSchema(error)) throw new AttendanceSelfNotConfiguredError()
  throw new DatabaseError(what, error)
}

/** A refusal raised by one of the functions, by its code. */
function raised(error: DbError, code: string): boolean {
  if (!error || isMissingSchema(error)) return false
  return (error.message ?? '').includes(code)
}

function toLink(row: LinkRow, now: Date): AttendanceLink {
  return {
    id: row.id,
    employeeId: row.employee_id,
    token: row.token,
    state: linkState(row.revoked_at, row.expires_at, now),
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    lastUsedAt: row.last_used_at,
    daysBack: row.days_back,
    autoApply: row.auto_apply,
    timeZone: row.time_zone,
  }
}

function toSubmission(row: SubmissionRow): AttendanceSubmission {
  return {
    id: row.id,
    employeeId: row.employee_id,
    date: String(row.date).slice(0, 10),
    status: row.status as SelfStatus,
    checkIn: hhmm(row.check_in),
    checkOut: hhmm(row.check_out),
    note: row.note,
    receivedAt: row.received_at,
    state: row.state as AttendanceSubmission['state'],
    decisionNote: row.decision_note,
  }
}

export class AttendanceLinkService {
  constructor(private readonly clock: () => Date = () => new Date()) {}

  // ─── for managers ─────────────────────────────────────────────────────────

  /** The employee's link that is not revoked (it may have expired), or null. */
  async current(ctx: TenancyContext, employeeId: string): Promise<AttendanceLink | null> {
    const { data, error } = await supabase
      .from('attendance_links')
      .select(LINK_COLUMNS)
      .eq('workspace_id', ctx.workspaceId)
      .eq('employee_id', employeeId)
      .is('revoked_at', null)
      .maybeSingle()
    check(error, 'Failed to read the attendance link')
    return data ? toLink(data as LinkRow, this.clock()) : null
  }

  async create(
    ctx: TenancyContext,
    input: {
      employeeId: string
      /** The last day the link works, `YYYY-MM-DD` in `timeZone`. Null = no end. */
      expiresOn: string | null
      daysBack: number
      autoApply: boolean
      timeZone: string
    },
  ): Promise<AttendanceLink> {
    if (!isIanaTimeZone(input.timeZone)) throw new ValidationError('ATTENDANCE_TIME_ZONE_INVALID')
    if (!Number.isInteger(input.daysBack) || input.daysBack < 0 || input.daysBack > MAX_DAYS_BACK) {
      throw new ValidationError('ATTENDANCE_DAYS_BACK_INVALID')
    }
    const now = this.clock()
    let expiresAt: string | null = null
    if (input.expiresOn !== null) {
      if (input.expiresOn < isoDayIn(input.timeZone, now)) {
        throw new ValidationError('ATTENDANCE_LINK_EXPIRY_IN_PAST')
      }
      // Through the end of that day wherever the shop is: the first instant
      // of the day after, at the widest offset a zone can have (UTC−12).
      expiresAt = new Date(
        Date.parse(`${addDays(input.expiresOn, 1)}T00:00:00.000Z`) + 12 * 3_600_000,
      ).toISOString()
    }

    const { data, error } = await supabase.rpc('attendance_link_create', {
      p_workspace: ctx.workspaceId,
      p_employee: input.employeeId,
      p_user: ctx.userId,
      p_token: randomBytes(32).toString('hex'),
      p_expires_at: expiresAt,
      p_days_back: input.daysBack,
      p_auto_apply: input.autoApply,
      p_time_zone: input.timeZone,
    })
    if (raised(error, 'ATTENDANCE_EMPLOYEE_NOT_FOUND')) throw new NotFoundError('Employee')
    check(error, 'Failed to make the attendance link')
    const row = (Array.isArray(data) ? data[0] : data) as LinkRow | null
    if (!row) throw new DatabaseError('The attendance link was not returned')
    return toLink(row, now)
  }

  async revoke(ctx: TenancyContext, linkId: string): Promise<void> {
    const { data, error } = await supabase
      .from('attendance_links')
      .update({ revoked_at: this.clock().toISOString() })
      .eq('workspace_id', ctx.workspaceId)
      .eq('id', linkId)
      .is('revoked_at', null)
      .select('id')
    check(error, 'Failed to revoke the attendance link')
    if ((data ?? []).length === 0) throw new NotFoundError('Attendance link')
  }

  /**
   * What employees sent for one day and nobody has decided, and which of the
   * day's records came from a link. `configured: false` before the migration —
   * the sheet reads this beside itself and must not fail with it.
   */
  async forDay(
    ctx: TenancyContext,
    date: string,
  ): Promise<{ configured: boolean; pending: AttendanceSubmission[]; fromLink: string[] }> {
    const pending = await selectAllPages<SubmissionRow, { message: string; code?: string }>(
      (from, to) =>
        supabase
          .from('attendance_submissions')
          .select(SUBMISSION_COLUMNS)
          .eq('workspace_id', ctx.workspaceId)
          .eq('date', date)
          .eq('state', 'pending')
          .order('received_at', { ascending: true })
          .order('id', { ascending: true })
          .range(from, to),
    )
    if (pending.error && isMissingSchema(pending.error)) {
      return { configured: false, pending: [], fromLink: [] }
    }
    if (pending.error) throw new DatabaseError('Failed to read submissions', pending.error)

    const marked = await selectAllPages<
      { employee_id: string },
      { message: string; code?: string }
    >((from, to) =>
      supabase
        .from('attendance')
        .select('employee_id')
        .eq('workspace_id', ctx.workspaceId)
        .eq('date', date)
        .eq('source', 'employee_link')
        .order('id', { ascending: true })
        .range(from, to),
    )
    if (marked.error && isMissingSchema(marked.error)) {
      return { configured: false, pending: [], fromLink: [] }
    }
    if (marked.error) throw new DatabaseError('Failed to read attendance sources', marked.error)

    return {
      configured: true,
      pending: (pending.data ?? []).map(toSubmission),
      fromLink: (marked.data ?? []).map((row) => row.employee_id),
    }
  }

  async decide(
    ctx: TenancyContext,
    submissionId: string,
    decision: 'approve' | 'reject',
    note: string | null,
  ): Promise<{ id: string; state: 'approved' | 'rejected'; employeeId: string; date: string }> {
    if (decision === 'reject' && !(note ?? '').trim()) {
      throw new ValidationError('ATTENDANCE_REJECTION_REASON_REQUIRED')
    }
    const { data, error } = await supabase.rpc('attendance_submission_decide', {
      p_workspace: ctx.workspaceId,
      p_id: submissionId,
      p_user: ctx.userId,
      p_decision: decision,
      p_note: note,
    })
    if (raised(error, 'ATTENDANCE_SUBMISSION_NOT_FOUND')) throw new NotFoundError('Submission')
    if (raised(error, 'ATTENDANCE_SUBMISSION_DECIDED')) {
      throw new ConflictError('ATTENDANCE_SUBMISSION_DECIDED')
    }
    if (raised(error, 'ATTENDANCE_REJECTION_REASON_REQUIRED')) {
      throw new ValidationError('ATTENDANCE_REJECTION_REASON_REQUIRED')
    }
    check(error, 'Failed to decide the submission')
    const out = data as {
      id: string
      state: 'approved' | 'rejected'
      employeeId: string
      date: string
    }
    return { ...out, date: String(out.date).slice(0, 10) }
  }

  // ─── for the employee ─────────────────────────────────────────────────────

  /**
   * The link behind a token, with its maker's present standing — or null for
   * one that is unknown, revoked, expired or orphaned. Which of those it was
   * is none of the holder's business.
   */
  private async resolve(token: string): Promise<{ link: LinkRow; ctx: TenancyContext } | null> {
    if (!/^[0-9a-f]{64}$/.test(token)) return null
    const { data, error } = await supabase
      .from('attendance_links')
      .select(LINK_COLUMNS)
      .eq('token', token)
      .is('revoked_at', null)
      .maybeSingle()
    check(error, 'Failed to read the attendance link')
    const link = data as LinkRow | null
    if (!link) return null
    if (linkState(link.revoked_at, link.expires_at, this.clock()) !== 'active') return null

    let ctx: TenancyContext
    try {
      ctx = await resolveWorkspaceAccess(link.created_by, link.workspace_id)
      // The maker must still hold what making a link needs.
      requireRole(ctx, 'manager')
    } catch {
      return null
    }
    return { link, ctx }
  }

  private window(link: LinkRow) {
    const today = isoDayIn(link.time_zone, this.clock())
    return { today, from: addDays(today, -link.days_back), to: today }
  }

  async view(token: string): Promise<AttendanceSelfView | null> {
    const found = await this.resolve(token)
    if (!found) return null
    const { link, ctx } = found
    const { today, from, to } = this.window(link)

    const [employee, business, records, submissions] = await Promise.all([
      supabase
        .from('employees')
        .select('first_name, last_name, position')
        .eq('workspace_id', ctx.workspaceId)
        .eq('id', link.employee_id)
        .maybeSingle(),
      supabase.from('workspaces').select('name').eq('id', ctx.workspaceId).maybeSingle(),
      supabase
        .from('attendance')
        .select('id, date, status, check_in, check_out')
        .eq('workspace_id', ctx.workspaceId)
        .eq('employee_id', link.employee_id)
        .gte('date', from)
        .lte('date', to)
        .order('id', { ascending: true }),
      supabase
        .from('attendance_submissions')
        .select(SUBMISSION_COLUMNS)
        .eq('workspace_id', ctx.workspaceId)
        .eq('employee_id', link.employee_id)
        .gte('date', from)
        .lte('date', to)
        .order('received_at', { ascending: false }),
    ])
    check(employee.error, 'Failed to read the employee')
    check(business.error, 'Failed to read the business')
    check(records.error, 'Failed to read attendance')
    check(submissions.error, 'Failed to read submissions')
    const person = employee.data as {
      first_name: string | null
      last_name: string | null
      position: string | null
    } | null
    if (!person) return null

    const recordByDay = new Map<
      string,
      { status: string; checkIn: string | null; checkOut: string | null }
    >()
    for (const row of (records.data ?? []) as Array<Record<string, unknown>>) {
      const day = String(row.date).slice(0, 10)
      // The first by id, as the sheet shows it.
      if (!recordByDay.has(day)) {
        recordByDay.set(day, {
          status: String(row.status ?? 'present'),
          checkIn: hhmm(row.check_in as string | null),
          checkOut: hhmm(row.check_out as string | null),
        })
      }
    }
    const sent = ((submissions.data ?? []) as SubmissionRow[]).map(toSubmission)

    const days: AttendanceSelfView['days'] = []
    for (let day = to; day >= from; day = addDays(day, -1)) {
      days.push({
        date: day,
        record: recordByDay.get(day) ?? null,
        submissions: sent
          .filter((submission) => submission.date === day)
          .map(({ employeeId: _employeeId, date: _date, ...rest }) => rest),
      })
    }

    const clock = new Intl.DateTimeFormat('en-GB', {
      timeZone: link.time_zone,
      hourCycle: 'h23',
      hour: '2-digit',
      minute: '2-digit',
    }).format(this.clock())

    return {
      businessName: (business.data as { name?: string } | null)?.name ?? null,
      employeeName: [person.first_name, person.last_name].filter(Boolean).join(' '),
      position: person.position,
      timeZone: link.time_zone,
      today,
      now: clock,
      allowedFrom: from,
      allowedTo: to,
      autoApply: link.auto_apply,
      days,
    }
  }

  /** Null = the link is not there (404). A broken rule throws its code. */
  async submit(
    token: string,
    input: SelfSubmitInput,
  ): Promise<{ id: string; state: AttendanceSubmission['state']; replayed: boolean } | null> {
    const found = await this.resolve(token)
    if (!found) return null
    const { link } = found
    const { from, to } = this.window(link)

    if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || addDays(input.date, 0) !== input.date) {
      throw new ValidationError('ATTENDANCE_DATE_INVALID')
    }
    if (input.date > to) throw new ValidationError('ATTENDANCE_DATE_IN_FUTURE')
    if (input.date < from) throw new ValidationError('ATTENDANCE_DATE_NOT_ALLOWED')
    if (!(SELF_STATUSES as readonly string[]).includes(input.status)) {
      throw new ValidationError('ATTENDANCE_STATUS_NOT_ALLOWED')
    }

    const present = input.status === 'present'
    // Times belong to a day at work — the same rule as the sheet's `mark`.
    const checkIn = present ? normalizeClock(input.checkIn) : null
    const checkOut = present ? normalizeClock(input.checkOut) : null
    if (present) {
      if ((input.checkIn ?? '') !== '' && checkIn === null) {
        throw new ValidationError('ATTENDANCE_TIME_INVALID')
      }
      if ((input.checkOut ?? '') !== '' && checkOut === null) {
        throw new ValidationError('ATTENDANCE_TIME_INVALID')
      }
      if (checkIn === null) throw new ValidationError('ATTENDANCE_CHECK_IN_REQUIRED')
      const start = minutesOf(checkIn)
      const end = checkOut === null ? null : minutesOf(checkOut)
      if (start === null || (checkOut !== null && end === null)) {
        throw new ValidationError('ATTENDANCE_TIME_INVALID')
      }
      if (end !== null && end <= start) {
        throw new ValidationError('ATTENDANCE_CHECK_OUT_BEFORE_CHECK_IN')
      }
    }
    const note = (input.note ?? '').trim() || null
    if (note && note.length > 500) throw new ValidationError('ATTENDANCE_NOTE_TOO_LONG')

    const call = () =>
      supabase.rpc('attendance_submit', {
        p_link: link.id,
        p_date: input.date,
        p_status: input.status,
        p_check_in: checkIn,
        p_check_out: checkOut,
        p_note: note,
        p_client_request_id: input.clientRequestId,
      })

    let { data, error } = await call()
    // The same form arrived twice at the same instant; the other one won.
    // Asking again answers with what it wrote.
    if (raised(error, 'ATTENDANCE_SUBMISSION_REPLAY')) ({ data, error } = await call())
    if (raised(error, 'ATTENDANCE_LINK_NOT_FOUND')) return null
    check(error, 'Failed to record the submission')
    return data as { id: string; state: AttendanceSubmission['state']; replayed: boolean }
  }
}

export const attendanceLinkService = new AttendanceLinkService()
