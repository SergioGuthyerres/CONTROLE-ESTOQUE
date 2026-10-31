/** @type {import('tailwindcss').Config} */

// As cores não são hex aqui: são variáveis CSS definidas em src/index.css.
//
// É o que faz o tema escuro existir sem mexer em tela nenhuma. Um
// `text-gray-500` escrito em qualquer componente continua sendo text-gray-500;
// o que muda é o valor da variável quando o <html> ganha data-tema="escuro".
// A alternativa — espalhar `dark:` em cada uma das ~190 classes de cor do app
// — daria o mesmo resultado visual e deixaria cada tela com o dobro de
// classes, com o risco de esquecer uma e ter texto cinza sobre fundo cinza.
//
// Só estão aqui os tons que o app realmente usa. Acrescentar um tom novo numa
// tela exige acrescentá-lo aqui e em src/index.css, nos dois temas.
const corVariavel = (nome) => `rgb(var(${nome}) / <alpha-value>)`;

export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        // Cor institucional. Clareia no tema escuro para continuar legível
        // sobre fundo escuro (documento de visão, seção 7: identidade visual
        // ainda provisória).
        marca: corVariavel("--marca"),

        // Superfície de cartão e campo. Existe porque `bg-white` não pode
        // virar escuro: `text-white` sobre botão colorido tem de continuar
        // branco nos dois temas.
        superficie: corVariavel("--superficie"),
        fundo: corVariavel("--fundo"),

        // Fundos das ações coloridas da tela inicial e dos botões de ação.
        // Nomeadas pelo papel, e não pelo tom, porque "vermelho" precisa ser
        // um vermelho diferente em cada tema — e porque a tela passa a dizer
        // o que o botão faz, não de que cor ele é.
        venda: corVariavel("--venda"),
        compra: corVariavel("--compra"),
        fiado: corVariavel("--fiado"),
        produtos: corVariavel("--produtos"),
        categorias: corVariavel("--categorias"),

        gray: {
          50: corVariavel("--cinza-50"),
          100: corVariavel("--cinza-100"),
          200: corVariavel("--cinza-200"),
          300: corVariavel("--cinza-300"),
          400: corVariavel("--cinza-400"),
          500: corVariavel("--cinza-500"),
          600: corVariavel("--cinza-600"),
          700: corVariavel("--cinza-700"),
        },
        red: {
          50: corVariavel("--vermelho-50"),
          100: corVariavel("--vermelho-100"),
          200: corVariavel("--vermelho-200"),
          400: corVariavel("--vermelho-400"),
          600: corVariavel("--vermelho-600"),
          700: corVariavel("--vermelho-700"),
        },
        green: {
          50: corVariavel("--verde-50"),
          200: corVariavel("--verde-200"),
          400: corVariavel("--verde-400"),
          700: corVariavel("--verde-700"),
          800: corVariavel("--verde-800"),
        },
        amber: {
          50: corVariavel("--ambar-50"),
          100: corVariavel("--ambar-100"),
          200: corVariavel("--ambar-200"),
          500: corVariavel("--ambar-500"),
          700: corVariavel("--ambar-700"),
        },
      },
    },
  },
  plugins: [],
};
