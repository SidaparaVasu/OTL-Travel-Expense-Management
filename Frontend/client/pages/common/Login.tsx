import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuthStore } from "@/src/store/authStore";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Eye, EyeOff, Plane } from "lucide-react";
import { useToast } from "@/components/ui/use-toast";
import loginIllustration from "@/assets/login-illustration.png";
// import OrangeLogo from "@/assets/Ultimatix-Logo.jpg";
import OrangeLogo from "@/assets/logo-otl-e1576143457585.png";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPass, setShowPass] = useState(false);

  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { toast } = useToast();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const redirectTo = await login(username, password);

      toast({
        title: "Welcome back!",
        description: "Login successful, redirecting...",
        duration: 1800,
      });

      navigate(redirectTo.startsWith("/") ? redirectTo : `/${redirectTo}`);
    } catch (error) {
      const response = JSON.parse(error.request?.response || "{}");
      const msg = response.errors?.non_field_errors?.[0] || "Invalid credentials";

      toast({
        title: "Login Failed",
        description: msg,
        variant: "destructive",
        duration: 2000,
      });
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-[63%_37%]">

      {/* Override Toast Position & Fonts */}
      <style>
        {`
          .ToastViewport {
            top: 20px !important;
            left: 50% !important;
            transform: translateX(-50%);
            right: auto !important;
          }
          @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap');
          * {
            font-family: 'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
          }
        `}
      </style>

      {/* LEFT COLUMN — FULL COVER IMAGE */}
      <div className="hidden lg:block relative bg-gradient-to-br from-blue-500 via-blue-600 to-purple-600 overflow-hidden">
        <img
          src={loginIllustration}
          alt="Travel Illustration"
          className="absolute inset-0 w-full h-full object-cover"
        />
      </div>

      {/* RIGHT COLUMN — FORM */}
      <div className="flex items-center justify-center bg-white px-8 py-12">
        <div className="w-full max-w-md">
          
          {/* Logo */}
          <div className="mb-6">
            <div className="flex items-center gap-2">
              <div className="h-10 w-10 rounded-lg flex items-center justify-left flex-shrink-0">
                {/* <div className="w-10 h-10 bg-blue-600 rounded-lg flex items-center justify-center"> */}
                {/*<Plane className="w-6 h-6 text-white" />*/}
                  <img src={OrangeLogo} alt="Orange LOGO" />
              </div>
              <span className="text-2xl font-bold text-gray-900">Orange Travel Expense</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-10">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">
              Welcome back!!!
            </h1>
            <p className="text-base text-gray-500">
              Access your travel requests, approvals, and expense claims.
            </p>
          </div>

          {/* Form */}
          <div className="space-y-4">

            {/* Username */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1.5">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Username"
                className="w-full h-12 px-4 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white transition-all"
              />
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1.5">
                Password
              </label>
              <div className="relative">
                <input
                  id="password"
                  type={showPass ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="w-full h-12 px-4 pr-12 text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-gray-900 focus:border-transparent bg-white transition-all"
                />
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  onClick={() => setShowPass(!showPass)}
                >
                  {showPass ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            {/* Login Button */}
            <Button
              onClick={handleSubmit}
              className="w-full h-12 bg-primary hover:bg-primary text-white font-semibold text-base rounded-md transition-all duration-200 mt-6 disabled:opacity-50 disabled:cursor-not-allowed"
              disabled={!username || !password || isLoading}
            >
              {isLoading ? "Signing in..." : "Continue"}
            </Button>
          </div>

          {/* Divider */}
          <div className="relative my-8">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-200"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">OR</span>
            </div>
          </div>

          {/* Footer Links */}
          <div className="text-center space-y-4">
            <div className="flex items-center justify-center gap-2 text-sm">
              <button type="button" className="text-blue-600 font-medium hover:underline">
                Forgot password?
              </button>
              <span className="text-gray-400">•</span>
              <button type="button" className="text-blue-600 font-medium hover:underline">
                Forgot username?
              </button>
            </div>
            {/* <p className="text-sm text-gray-600">
              Don't have an account?{" "}
              <button type="button" className="text-purple-600 font-medium hover:underline">
                Sign up
              </button>
            </p> */}
          </div>
        </div>
      </div>

    </div>
  );
}