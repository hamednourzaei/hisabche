import { can, roleAtLeast, sessionCan } from '../permissions'
import type { Session } from '../types'
import { parseSession, serializeSession } from '../session'

const session: Session = {
  user: { id: 'u1', email: 'a@b.c', fullName: 'A', createdAt: '2026-01-01T00:00:00.000Z' },
  token: 't',
  workspace: { workspaceId: 'w1', workspaceName: 'W', role: 'admin' },
}

describe('roles', () => {
  it('ranks roles in order', () => {
    expect(roleAtLeast('owner', 'admin')).toBe(true)
    expect(roleAtLeast('viewer', 'member')).toBe(false)
  })

  it('reserves deletion for owners', () => {
    expect(can('admin', 'record.delete')).toBe(false)
    expect(can('owner', 'record.delete')).toBe(true)
  })

  it('lets viewers read but not create', () => {
    expect(can('viewer', 'record.read')).toBe(true)
    expect(can('viewer', 'record.create')).toBe(false)
  })
})

describe('sessionCan', () => {
  it('denies everything without a session', () => {
    expect(sessionCan(null, 'record.read')).toBe(false)
  })

  it('uses the workspace role', () => {
    expect(sessionCan(session, 'member.invite')).toBe(true)
    expect(sessionCan(session, 'workspace.manage')).toBe(false)
  })
})

describe('session serialization', () => {
  it('round-trips a valid session', () => {
    expect(parseSession(serializeSession(session))).toEqual(session)
  })

  it('rejects malformed payloads', () => {
    expect(parseSession('not json')).toBeNull()
    expect(parseSession(JSON.stringify({ token: '' }))).toBeNull()
    expect(parseSession(null)).toBeNull()
  })
})
