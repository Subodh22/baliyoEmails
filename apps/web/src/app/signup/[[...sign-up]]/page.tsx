import { SignUp } from "@clerk/nextjs";

export default function SignupPage() {
  return (
    <div className="min-h-screen bg-[#0A0A0A] flex items-center justify-center">
      <div>
        <div className="text-center mb-8">
          <div className="h-10 w-10 rounded-xl bg-[#D4924A] flex items-center justify-center mx-auto mb-4">
            <span className="text-lg font-bold text-[#0A0A0A]">B</span>
          </div>
          <h1 className="text-lg font-medium text-[#EDEDED]">Get started</h1>
          <p className="text-sm text-[#555] mt-1">Create your Baliyoemails account</p>
        </div>
        <SignUp />
      </div>
    </div>
  );
}
