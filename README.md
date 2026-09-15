# Landing Page iGreen Energy

Landing page estática voltada à apresentação da oportunidade de licenciamento,
qualificação de interessados e captação de leads.

## Estrutura do projeto

- `index.html`: conteúdo, ordem das seções, formulários e integrações carregadas
  pela página.
- `style.css`: identidade visual, componentes, estados, responsividade e ajustes
  finais de legibilidade.
- `script.js`: quiz, simulador de carteira, prova social, vídeos, modais, cards
  expansíveis e envio dos leads.
- `img/`: imagens institucionais e provas sociais.
- `videos/`: vídeos locais e respectivas capas.

Os três arquivos principais possuem um índice no início e cabeçalhos numerados.
No HTML e no CSS, a ordem dos blocos acompanha a jornada visual da página.

## Pontos de integração

As configurações externas ficam concentradas no objeto `CONFIG`, no início de
`script.js`:

- URL de ativação da licença;
- número do atendimento por WhatsApp;
- endpoint e identificador usados no envio para o Google Sheets.

O Microsoft Clarity é carregado de forma assíncrona no `<head>` de `index.html`
com o identificador público do projeto. Formulários e resultados personalizados
utilizam `data-clarity-mask="true"` para reforçar a proteção dos dados dos leads.

Os vídeos do YouTube dependem de `data-youtube-autoplay` no contêiner e de um
`id` único no `iframe`. Os formulários dependem dos identificadores usados em
`script.js`; por isso, qualquer alteração de `id` deve ser refletida nos dois
arquivos.

O simulador de carteira usa quantidades de clientes e bases ilustrativas fixas
para facilitar a comparação entre os perfis Licenciado e Cliente que indica. As
taxas e condições devem continuar acompanhadas do aviso sobre elegibilidade e
regras vigentes.

## Convenções de manutenção

1. Preserve a ordem das seções no HTML e das regras correspondentes no CSS.
2. Mantenha os ajustes globais de legibilidade no final de `style.css`, pois a
   posição faz parte da prioridade da cascata.
3. Não reduza textos informativos para menos de `15px`.
4. Mantenha apenas um vídeo ativo por vez e respeite o bloqueio de reinício após
   uma pausa manual.
5. Valide desktop e mobile depois de alterar layout, vídeo, formulário ou quiz.

## Validação

Execute `node tools/validate-page.js` para verificar automaticamente:

- sintaxe JavaScript e balanceamento dos blocos CSS;
- estrutura básica do HTML e IDs duplicados;
- associações entre labels, campos e referências do JavaScript;
- existência dos arquivos locais usados pela página.

Além da validação automática, recomenda-se:

- comparar a renderização em desktop e mobile;
- testar quiz, filtros, lightbox, vídeos, cards expansíveis e os dois formulários;
- revisar o diff antes de criar um commit.
