// Define a senha de um usuário (e-mail ou celular), reativando o acesso e sem obrigar a troca
// Uso: npx tsx --env-file=.env prisma/set-password.ts <email-ou-celular> <nova-senha>
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { normalizePhone } from "../src/lib/phone";

const prisma = new PrismaClient();

async function main() {
  const [login, password] = process.argv.slice(2);
  if (!login || !password) throw new Error("Uso: npx tsx --env-file=.env prisma/set-password.ts <email-ou-celular> <nova-senha>");
  if (password.length < 8) throw new Error("A senha precisa ter pelo menos 8 caracteres");

  const phone = login.includes("@") ? null : normalizePhone(login);
  if (!login.includes("@") && !phone) throw new Error(`Celular ${login} inválido`);
  const user = await prisma.user.findUnique({ where: phone ? { phone } : { email: login.trim().toLowerCase() } });
  if (!user) throw new Error(`Usuário ${login} não encontrado`);
  if (user.deletedAt) throw new Error(`O usuário ${login} foi excluído`);

  await prisma.user.update({
    where: { id: user.id },
    data: { passwordHash: await bcrypt.hash(password, 10), mustChangePassword: false, active: true },
  });
  console.log(`Senha de ${user.name} (${user.email || user.phone}) atualizada.`);
}

main()
  .catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1); })
  .finally(() => prisma.$disconnect());
