// ============================================
// backend/src/services/auth.service.ts
// ============================================

import { z } from 'zod'
import { supabase } from '../db'
import { LoginInput, SignUpInput } from '@hisabche/validation'
import * as bcrypt from 'bcrypt'
import jwt from 'jsonwebtoken'
import { AuthError } from '../errors/auth.error'

const JWT_SECRET = process.env.JWT_SECRET || 'hisabche-secret-key-change-in-production'
const SALT_ROUNDS = 12
const RESET_TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

export class AuthService {
  // ─── Login ──────────────────────────────────────────────
  async login(data: LoginInput) {
    const { data: user, error } = await supabase
      .from('users')
      .select('*')
      .eq('email', data.email)
      .single()

    if (error || !user) {
      throw new AuthError('Invalid email or password')
    }

    const valid = await bcrypt.compare(data.password, user.password_hash)
    if (!valid) {
      throw new AuthError('Invalid email or password')
    }

    const token = this.generateToken(user.id, user.email)

    return {
      user: this.sanitizeUser(user),
      token,
    }
  }

  // ─── SignUp ─────────────────────────────────────────────
  async signup(data: SignUpInput) {
    const existing = await supabase
      .from('users')
      .select('id')
      .eq('email', data.email)
      .single()

    if (existing.data) {
      throw new AuthError('Email already registered')
    }

    const hash = await bcrypt.hash(data.password, SALT_ROUNDS)

    const { data: user, error } = await supabase
      .from('users')
      .insert({
        email: data.email,
        password_hash: hash,
        full_name: data.fullName,
        business_name: data.businessName || null,
        is_active: true,
      })
      .select()
      .single()

    if (error || !user) {
      throw new AuthError('Failed to create account')
    }

    const token = this.generateToken(user.id, user.email)

    return {
      user: this.sanitizeUser(user),
      token,
    }
  }

  // ─── Logout ─────────────────────────────────────────────
  async logout(userId: string): Promise<void> {
    // Option 1: Blacklist token in Redis
    // Option 2: Just return success (client discards token)
    // We'll implement Redis blacklist later
    return
  }

  // ─── Me ─────────────────────────────────────────────────
  async getMe(userId: string) {
    const { data: user, error } = await supabase
      .from('users')
      .select('id, email, full_name, business_name, avatar_url, created_at')
      .eq('id', userId)
      .single()

    if (error || !user) {
      throw new AuthError('User not found')
    }

    return this.sanitizeUser(user)
  }

  // ─── Forgot Password ────────────────────────────────────
  async forgotPassword(email: string): Promise<void> {
    const { data: user } = await supabase
      .from('users')
      .select('id')
      .eq('email', email)
      .single()

    if (!user) return // Don't reveal if email exists

    const token = jwt.sign(
      { userId: user.id, purpose: 'password-reset' },
      JWT_SECRET,
      { expiresIn: '24h' }
    )

    // Store token in DB or Redis
    await supabase
      .from('password_resets')
      .insert({
        user_id: user.id,
        token: token,
        expires_at: new Date(Date.now() + RESET_TOKEN_EXPIRY).toISOString(),
        used: false,
      })

    // In production: send email with reset link
    // await emailService.sendResetEmail(email, token)
  }

  // ─── Reset Password ─────────────────────────────────────
  async resetPassword(token: string, newPassword: string): Promise<void> {
    // Verify token
    let decoded: any
    try {
      decoded = jwt.verify(token, JWT_SECRET)
    } catch {
      throw new AuthError('Invalid or expired token')
    }

    if (decoded.purpose !== 'password-reset') {
      throw new AuthError('Invalid token purpose')
    }

    // Check if token exists and is not used
    const { data: resetRecord } = await supabase
      .from('password_resets')
      .select('*')
      .eq('token', token)
      .eq('used', false)
      .single()

    if (!resetRecord) {
      throw new AuthError('Invalid or expired token')
    }

    if (new Date(resetRecord.expires_at) < new Date()) {
      throw new AuthError('Token has expired')
    }

    // Hash new password
    const hash = await bcrypt.hash(newPassword, SALT_ROUNDS)

    // Update user password
    const { error } = await supabase
      .from('users')
      .update({ password_hash: hash, updated_at: new Date().toISOString() })
      .eq('id', decoded.userId)

    if (error) {
      throw new AuthError('Failed to reset password')
    }

    // Mark token as used
    await supabase
      .from('password_resets')
      .update({ used: true })
      .eq('id', resetRecord.id)
  }

  // ─── Update Profile ─────────────────────────────────────
  async updateProfile(userId: string, data: { 
    fullName?: string 
    businessName?: string 
    avatarUrl?: string 
  }) {
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
    if (data.fullName !== undefined) updates.full_name = data.fullName
    if (data.businessName !== undefined) updates.business_name = data.businessName
    if (data.avatarUrl !== undefined) updates.avatar_url = data.avatarUrl

    const { data: user, error } = await supabase
      .from('users')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (error || !user) {
      throw new AuthError('Failed to update profile')
    }

    return this.sanitizeUser(user)
  }

  // ─── Private Helpers ────────────────────────────────────
  private generateToken(userId: string, email: string): string {
    return jwt.sign(
      { userId, email },
      JWT_SECRET,
      { expiresIn: '7d' }
    )
  }

  private sanitizeUser(user: any) {
    return {
      id: user.id,
      email: user.email,
      fullName: user.full_name,
      businessName: user.business_name,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at,
    }
  }
}