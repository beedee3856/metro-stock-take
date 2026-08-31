/**
 * Password validation and strength checking utility
 */

export interface PasswordStrength {
  score: number; // 0-5
  level: "WEAK" | "FAIR" | "GOOD" | "STRONG" | "VERY_STRONG";
  meets: {
    minLength: boolean; // 8+ chars
    uppercase: boolean; // A-Z
    lowercase: boolean; // a-z
    numbers: boolean; // 0-9
    special: boolean; // !@#$%^&*
  };
  message: string;
}

export function validatePasswordStrength(password: string): PasswordStrength {
  const meets = {
    minLength: password.length >= 8,
    uppercase: /[A-Z]/.test(password),
    lowercase: /[a-z]/.test(password),
    numbers: /\d/.test(password),
    special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
  };

  let score = 0;
  if (meets.minLength) score++;
  if (meets.uppercase) score++;
  if (meets.lowercase) score++;
  if (meets.numbers) score++;
  if (meets.special) score++;

  let level: "WEAK" | "FAIR" | "GOOD" | "STRONG" | "VERY_STRONG";
  let message: string;

  if (score === 0 || password.length === 0) {
    level = "WEAK";
    message = "Password is required";
  } else if (score === 1) {
    level = "WEAK";
    message = "Password is too weak";
  } else if (score === 2) {
    level = "FAIR";
    message = "Password is fair but could be stronger";
  } else if (score === 3) {
    level = "GOOD";
    message = "Password is good";
  } else if (score === 4) {
    level = "STRONG";
    message = "Password is strong";
  } else {
    level = "VERY_STRONG";
    message = "Password is very strong";
  }

  return {
    score,
    level,
    meets,
    message,
  };
}

export function isPasswordStrong(password: string): boolean {
  const strength = validatePasswordStrength(password);
  // Require at least STRONG (score 4)
  return strength.score >= 4;
}
