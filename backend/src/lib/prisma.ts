import { PrismaClient } from "@prisma/client";

// Instância única do Prisma Client compartilhada pela aplicação — evitar dar
// "new PrismaClient()" em outros arquivos (esgota conexões em dev com hot reload).
export const prisma = new PrismaClient();
