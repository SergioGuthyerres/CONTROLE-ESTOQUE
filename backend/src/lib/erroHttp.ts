// Erro com status HTTP, jogado de qualquer lugar e transformado em resposta
// pelo tratador global (src/middleware/erros.ts).
//
// Mora em lib/ e não junto do tratador de propósito: assim uma regra de
// negócio pura — que só precisa dizer "isso é 409" — pode importar daqui sem
// arrastar junto o middleware, o zod e o src/lib/env, que encerra o processo
// quando não encontra as variáveis de ambiente. Sem essa separação, testar a
// regra exigiria montar um .env inteiro.
export class ErroHttp extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
