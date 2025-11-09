import { useNavigate } from "react-router-dom";
import { useState } from "react";
import toast, { Toaster } from "react-hot-toast";
import Cookies from "js-cookie";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const Login = () => {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    
    if (!email.trim() || !password.trim()) {
      toast.error("Please enter both email and password");
      return;
    }

    setIsLoading(true);

    try {
      const apiBaseUrl = import.meta.env.VITE_API_BASE_URL;
      const response = await fetch(`${apiBaseUrl}/auth/login`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email,
          password,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        // Store access token in cookie
        if (data.access_token) {
          Cookies.set("access_token", data.access_token, { expires: 7 }); // Expires in 7 days
        }
        
        // Store book_ids in sessionStorage
        if (data.book_ids && Array.isArray(data.book_ids)) {
          sessionStorage.setItem("book_ids", JSON.stringify(data.book_ids));
        }
        
        // Store user_id in sessionStorage
        if (data.user_id) {
          sessionStorage.setItem("user_id", data.user_id);
        }
        
        // Console log user_id and book_ids
        console.log("User ID:", data.user_id);
        console.log("Book IDs:", data.book_ids);
        
        toast.success("Login successful!");
        
        // Navigate to home page after a short delay
        setTimeout(() => {
          navigate("/");
        }, 1000);
      } else {
        toast.error(data.message || "Login failed. Please check your credentials.");
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("An error occurred. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-[#0a0a0a] px-4">
      <Toaster position="top-right" />
      <div className="w-full max-w-[400px] space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-xl text-gray-300 font-normal">
            Login to your account
          </h1>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email Field */}
          <div className="space-y-2">
            <Label htmlFor="email" className="text-white text-sm font-normal">
              Email
            </Label>
            <Input
              id="email"
              type="email"
              placeholder="m@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isLoading}
              required
              className="bg-transparent border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Password Field */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <Label htmlFor="password" className="text-white text-sm font-normal">
                Password
              </Label>
              <a
                href="#"
                className="text-sm text-gray-400 hover:text-gray-300 transition-colors"
                onClick={(e) => {
                  e.preventDefault();
                  toast.error("Password reset not implemented yet");
                }}
              >
                {/* Forgot your password? */}
              </a>
            </div>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isLoading}
              required
              className="bg-transparent border-gray-700 text-white placeholder:text-gray-500"
            />
          </div>

          {/* Login Button */}
          <Button
            type="submit"
            className="w-full bg-white text-black hover:bg-gray-200 font-normal"
            disabled={isLoading}
            size="lg"
          >
            {isLoading ? "Logging in..." : "Login"}
          </Button>
        </form>

        {/* Signup Link */}
        <div className="text-center">
          <p className="text-sm text-gray-400">
            Don't have an account?{" "}
            <button
              onClick={() => navigate("/signup")}
              className="text-white hover:text-gray-300 underline transition-colors font-medium"
            >
              Sign up
            </button>
          </p>
        </div>
      </div>
    </div>
  );
};

export default Login;
