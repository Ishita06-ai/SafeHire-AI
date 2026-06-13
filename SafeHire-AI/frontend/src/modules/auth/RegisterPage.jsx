import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Link } from "react-router-dom";
import { Mail, Lock, User, Shield, Building } from "lucide-react";
import { motion } from "framer-motion";
import { Input }     from "../../components/ui/Input";
import { Button }    from "../../components/ui/Button";
import { useRegister } from "./hooks/useAuth";

const registerSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  email:    z.string().email("Enter a valid email"),
  password: z.string()
    .min(8, "Password must be at least 8 characters")
    .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, "Must contain uppercase, lowercase and number"),
  college:  z.string().optional(),
});

export default function RegisterPage() {
  const { mutate: register_, isPending } = useRegister();

  const { register, handleSubmit, formState: { errors } } = useForm({
    resolver: zodResolver(registerSchema),
  });

  return (
    <div className="min-h-screen bg-surface-900 flex items-center justify-center p-4">

      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-1/3 left-1/2 -translate-x-1/2 w-96 h-96
                        bg-purple-600/10 rounded-full blur-3xl" />
      </div>

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-md"
      >
        <div className="flex items-center justify-center gap-2 mb-8">
          <div className="w-10 h-10 bg-brand-600 rounded-xl flex items-center justify-center">
            <Shield className="w-5 h-5 text-white" />
          </div>
          <span className="text-xl font-bold gradient-text">SafeHire AI</span>
        </div>

        <div className="glass-card p-8">
          <h1 className="text-2xl font-bold text-white mb-1">Create account</h1>
          <p className="text-gray-500 text-sm mb-6">
            Protect yourself from recruitment scams
          </p>

          <form onSubmit={handleSubmit((data) => register_(data))} className="space-y-4">
            <Input
              label="Full Name"
              placeholder="Rahul Sharma"
              leftIcon={<User className="w-4 h-4" />}
              error={errors.fullName?.message}
              {...register("fullName")}
            />

            <Input
              label="Email"
              type="email"
              placeholder="rahul@college.edu"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              {...register("email")}
            />

            <Input
              label="Password"
              type="password"
              placeholder="Min 8 chars, uppercase + number"
              leftIcon={<Lock className="w-4 h-4" />}
              error={errors.password?.message}
              hint="Must contain uppercase, lowercase and a number"
              {...register("password")}
            />

            <Input
              label="College (optional)"
              placeholder="IIT Bombay, VIT Pune..."
              leftIcon={<Building className="w-4 h-4" />}
              error={errors.college?.message}
              {...register("college")}
            />

            <Button
              type="submit"
              size="lg"
              isLoading={isPending}
              className="w-full mt-2"
            >
              Create account
            </Button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{" "}
            <Link to="/login" className="text-brand-500 hover:text-brand-400 font-medium">
              Sign in
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  );
}