import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import ChangePasswordForm from "@/components/ChangePasswordForm";

// Primeiro acesso (ou senha redefinida): troca obrigatória da senha provisória
export default async function TrocarSenhaPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustChangePassword) redirect("/dashboard");

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-dark to-primary p-4">
      <div className="bg-white rounded-2xl shadow-2xl p-8 w-full max-w-md">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/brand/logo.svg" alt="BIO CELL by VETNIL" className="w-48 h-auto mx-auto mb-6" />
        <h1 className="text-xl font-bold text-gray-900 text-center">Olá, {session.name.split(" ")[0]}!</h1>
        <p className="text-sm text-gray-500 text-center mt-1 mb-6">
          Para sua segurança, crie uma senha pessoal no lugar da senha provisória que você recebeu.
        </p>
        <ChangePasswordForm forced />
      </div>
    </div>
  );
}
