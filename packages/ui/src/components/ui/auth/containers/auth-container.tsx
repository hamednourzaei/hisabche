"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { useAuthStore, type User } from "@hisabche/store";
import { loginSchema, type LoginInput } from "@hisabche/validation";
import { AuthShell } from "@hisabche/ui";
import { supabaseClient } from "../../../../../../auth/src/supabase";

/* ═══════════════════════════════════════════════════════════════════════════
   AuthContainer v2 — Fixed switch mode + signup submit
   ═══════════════════════════════════════════════════════════════════════════ */

const signupSchema = z.object({
  fullName: z.string().min(2, "signup.errors.fullName"),
  companyName: z.string().min(2, "signup.errors.companyName"),
  phone: z.string().optional().or(z.literal("")),
  email: z.string().min(1, "signup.errors.emailRequired").email("signup.errors.emailInvalid"),
  password: z.string().min(8, "signup.errors.passwordMin"),
});
type SignupInput = z.infer<typeof signupSchema>;

function useSafeT() {
  const { t } = useTranslation();
  return (key: string, fallback: string) => {
    const v = t(key);
    return v && v !== key ? v : fallback;
  };
}

export function AuthContainer({ initialMode = "login" }: { initialMode?: "login" | "signup" }) {
  const router = useRouter();
  const { t } = useTranslation();
  const st = useSafeT();
  const [flipped, setFlipped] = useState(initialMode === "signup");

  // ─── Switch mode ──────────────────────────────
const handleSwitch = useCallback(() => {
  setFlipped((prev) => {
    const newFlipped = !prev;
    // URL رو با حالت جدید sync کن
    if (newFlipped) {
      router.replace("/signup", { scroll: false });
    } else {
      router.replace("/login", { scroll: false });
    }
    return newFlipped;
  });
}, [router]);

  // ─── Login form ────────────────────────────────
  const loginForm = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: "", password: "" },
  });
  const [loginShowPassword, setLoginShowPassword] = useState(false);
  const loginStore = useAuthStore();

  const onLoginSubmit = loginForm.handleSubmit(async (data: LoginInput) => {
    const { error } = await supabaseClient.auth.signInWithPassword({
      email: data.email,
      password: data.password,
    });
    if (error) {
      useAuthStore.setState({ error: error.message, isLoading: false });
      return;
    }

    await loginStore.login(data);
    const s = useAuthStore.getState();
    if (s.isAuthenticated && !s.error) {
      router.push("/dashboard");
    }
  });

  const onDemoLogin = useCallback(async () => {
    await loginStore.login({ email: "demo@hisabche.com", password: "Demo1234" });
    const s = useAuthStore.getState();
    if (s.isAuthenticated && !s.error) {
      router.push("/dashboard");
    }
  }, [loginStore, router]);

  const loginProps = {
    st,
    serverError: loginStore.error,
    isLoading: loginStore.isLoading,
    errors: loginForm.formState.errors as Record<string, { message?: string } | undefined>,
    register: loginForm.register as any,
    watch: loginForm.watch as any,
    handleSubmit: loginForm.handleSubmit as any,
    showPassword: loginShowPassword,
    togglePassword: () => setLoginShowPassword(!loginShowPassword),
    onSwitchMode: handleSwitch,
    onSubmit: onLoginSubmit as any,
    onDemoLogin,
  };

  // ─── Signup form ───────────────────────────────
  const signupForm = useForm<SignupInput>({
    resolver: zodResolver(signupSchema),
    defaultValues: { fullName: "", companyName: "", phone: "", email: "", password: "" },
  });
  const [signupShowPassword, setSignupShowPassword] = useState(false);
  const signupStore = useAuthStore();

const onSignupSubmit = signupForm.handleSubmit(async (data: SignupInput) => {
  const { data: authData, error } = await supabaseClient.auth.signUp({
    email: data.email,
    password: data.password,
    options: { data: { full_name: data.fullName } },
  });
  
  if (error) {
    useAuthStore.setState({ error: error.message, isLoading: false });
    return;
  }

  // ✅ اگه user برگشت (بعضی وقتا Supabase auto-confirm میکنه)
  if (authData?.user) {
    const user: User = {
      id: authData.user.id,
      email: authData.user.email || data.email,
      fullName: data.fullName,
      businessName: data.companyName,
      createdAt: authData.user.created_at || new Date().toISOString(),
    };
    useAuthStore.setState({ user, isAuthenticated: true, isDemo: false, isLoading: false });
    router.push("/dashboard");
    return;
  }

  // ⚠️ اگه user برنگشت — نیاز به email verification
  useAuthStore.setState({ 
    error: "لطفاً ایمیل خود را تأیید کنید. لینک تأیید به ایمیل شما ارسال شد.",
    isLoading: false 
  });
});
  const translateError = (k?: string) => (k ? t(k, k) : undefined);

  const signupProps = {
    st,
    serverError: signupStore.error,
    isLoading: signupStore.isLoading,
    errors: signupForm.formState.errors as Record<string, { message?: string } | undefined>,
    register: signupForm.register as any,
    watch: signupForm.watch as any,
    handleSubmit: signupForm.handleSubmit as any,
    showPassword: signupShowPassword,
    togglePassword: () => setSignupShowPassword(!signupShowPassword),
    onSwitchMode: handleSwitch,
    onSubmit: onSignupSubmit as any,
    translateError,
  };

  return (
    <AuthShell
      flipped={flipped}
      st={st}
      loginProps={loginProps}
      signupProps={signupProps}
      onSwitchMode={handleSwitch}
    />
  );
}