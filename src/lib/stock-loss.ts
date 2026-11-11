// Baixa por perda: palheta que estourou/quebrou (ou insumo danificado), sempre com foto.
// Fica no estoque como movimentação do tipo LOSS, para a matriz conferir e repor.
export const LOSS_TYPE = "LOSS";

export const LOSS_CAUSES = [
  "Palheta estourou",
  "Palheta quebrada / trincada",
  "Danificado no transporte",
  "Outro",
] as const;

export const MAX_LOSS_PHOTOS = 3;
