import { useState } from "react";
import { useSearchParams, Link } from "react-router-dom";
import { Eye, EyeOff, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const token = searchParams.get("token") || "";
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async () => {
    if (!password) return toast.error("Please enter a new password");
    if (password.length < 6) return toast.error("Password must be at least 6 characters");
    if (password !== confirmPassword) return toast.error("Passwords do not match");
    if (!token) return toast.error("Invalid reset link");

    setLoading(true);
    try {
      const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";
      const res = await fetch(`${API_URL}/api/auth/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json();
      if (res.ok) {
        setSuccess(true);
        toast.success("Password reset successfully");
      } else {
        toast.error(data.error || "Failed to reset password");
      }
    } catch {
      toast.error("Network error. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden px-4 py-12">
      <div className="absolute inset-0 bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 animate-pulse"></div>
      </div>

      <div className="relative z-10 w-full max-w-md">
        <div className="backdrop-blur-xl bg-white/10 rounded-3xl shadow-2xl border border-white/20 p-8 md:p-12">
          {success ? (
            <div className="text-center space-y-5">
              <CheckCircle className="w-16 h-16 mx-auto text-green-400" />
              <h2 className="text-2xl font-bold text-white">Password Reset</h2>
              <p className="text-gray-300 text-sm">Your password has been changed. You can now sign in with your new password.</p>
              <Link
                to="/publisher/signin"
                className="inline-block w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 text-white font-semibold rounded-xl text-center"
              >
                Go to Sign In
              </Link>
            </div>
          ) : (
            <>
              <div className="text-center mb-8">
                <h2 className="text-3xl font-bold text-white mb-2">Reset Password</h2>
                <p className="text-gray-300 text-sm">Enter your new password below</p>
              </div>
              <div className="space-y-5">
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">New Password</label>
                  <div className="relative">
                    <input
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 pr-12"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white"
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-200 mb-2">Confirm Password</label>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && handleReset()}
                    placeholder="••••••••"
                    className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <button
                  onClick={handleReset}
                  disabled={loading}
                  className="w-full py-3 bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white font-semibold rounded-xl disabled:opacity-50 transition-all"
                >
                  {loading ? "Resetting..." : "Reset Password"}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
