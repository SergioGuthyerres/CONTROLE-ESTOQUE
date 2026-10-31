// Ícones das ações do menu.
//
// Desenhados aqui em vez de virem de uma biblioteca: são cinco, o app é um
// PWA que precisa carregar rápido no 3G da loja, e um pacote de ícones
// inteiro para cinco desenhos é peso que ninguém usa. Todos herdam a cor do
// texto (`currentColor`) e o tamanho da classe, então servem em cima de
// qualquer fundo nos dois temas.
//
// São decorativos: quem lê a tela com leitor de tela ouve o texto ao lado,
// não o ícone — daí o aria-hidden.

interface Props {
  className?: string;
}

function Base({ className = "h-7 w-7", children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`${className} shrink-0`}
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function IconeVenda(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 6h18l-1.6 9.2a2 2 0 0 1-2 1.8H6.6a2 2 0 0 1-2-1.7L3 4H1" />
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="17" cy="20" r="1.4" />
    </Base>
  );
}

export function IconeCompra(props: Props) {
  return (
    <Base {...props}>
      <path d="M21 8 12 3 3 8l9 5 9-5Z" />
      <path d="M3 12l9 5 9-5M3 16l9 5 9-5" />
    </Base>
  );
}

export function IconeFiado(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 4h12l4 4v12H4z" />
      <path d="M8 10h8M8 14h5" />
    </Base>
  );
}

export function IconeProdutos(props: Props) {
  return (
    <Base {...props}>
      <rect x="3" y="7" width="18" height="13" rx="2" />
      <path d="M8 7V5a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
    </Base>
  );
}

export function IconeCategorias(props: Props) {
  return (
    <Base {...props}>
      <path d="M3 7h7l2 2h9v10a2 2 0 0 1-2 2H3z" />
      <path d="M3 7V5h5l2 2" />
    </Base>
  );
}

export function IconePainel(props: Props) {
  return (
    <Base {...props}>
      <path d="M4 19V10M10 19V5M16 19v-7M22 19H2" />
    </Base>
  );
}

export function IconeConfirmado(props: Props) {
  return (
    <Base {...props} className={props.className ?? "h-5 w-5"}>
      <path d="M20 6 9 17l-5-5" />
    </Base>
  );
}
