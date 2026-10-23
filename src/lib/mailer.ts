import nodemailer from "nodemailer";
import { formatPhone } from "./phone";

// Envio de e-mail pela caixa da BIO CELL (SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS; SMTP_FROM opcional).
// Sem essas variáveis o sistema só mostra a senha na tela, como antes.
export function mailerConfigured() {
  return !!(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);
}

function transport() {
  const port = Number(process.env.SMTP_PORT) || 465;
  return nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
  });
}

const escapeHtml = (v: string) => v.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

// Manda o acesso com a senha provisória; devolve se foi enviado (falha não impede criar/redefinir o acesso)
export async function sendAccessEmail(
  user: { name: string; email: string | null; phone: string | null },
  tempPassword: string,
  appUrl: string,
  isReset: boolean,
) {
  if (!user.email || !mailerConfigured()) return false;
  const login = [`E-mail: ${user.email}`, user.phone && `Celular: ${formatPhone(user.phone)}`].filter(Boolean).join("\n");
  const intro = isReset ? "Foi gerada uma nova senha provisória para o seu acesso" : "Seu acesso foi criado";
  const text = `Olá, ${user.name}!\n\n${intro} ao sistema BIO CELL (prontuário e estoque).\n\nEndereço: ${appUrl}\n${login}\nSenha provisória: ${tempPassword}\n\nNo primeiro acesso o sistema pede para você criar uma senha pessoal.`;
  try {
    await transport().sendMail({
      from: process.env.SMTP_FROM || `BIO CELL <${process.env.SMTP_USER}>`,
      to: user.email,
      subject: isReset ? "Nova senha de acesso – BIO CELL" : "Seu acesso ao sistema BIO CELL",
      text,
      html: `<div style="font-family:Arial,sans-serif;font-size:15px;color:#1f2937;line-height:1.5">${escapeHtml(text)
        .replace(/\n/g, "<br>")
        .replace(escapeHtml(tempPassword), `<b style="font-family:monospace;font-size:18px">${escapeHtml(tempPassword)}</b>`)}</div>`,
    });
    return true;
  } catch (err) {
    console.error("Erro ao enviar e-mail de acesso:", err);
    return false;
  }
}
