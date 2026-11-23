# 📥 Discord Media Saver

<p align="center">
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-339933?logo=node.js&logoColor=white" alt="Node >= 18">
  <img src="https://img.shields.io/badge/tipo-selfbot-red" alt="Selfbot">
  <img src="https://img.shields.io/badge/licença-MIT-blue" alt="Licença MIT">
  <img src="https://img.shields.io/badge/status-educacional-orange" alt="Projeto educacional">
</p>

Ferramenta de linha de comando que varre **todos os canais, threads e fóruns** de um servidor do Discord e baixa **todas as fotos e vídeos** postados, salvando tudo em **uma única pasta**, com barra de progresso e retomada automática.

> 🎓 **Projeto educacional.** Este repositório existe para servir de **base de estudo** sobre a API do Discord, bots, automações e, especificamente, como selfbots funcionam por dentro (login via token, rate limit, varredura de histórico, download assíncrono em lote). Sinta-se à vontade para ler o código, modificar, quebrar e aprender.

```
╔══════════════════════════════════════════════╗
║        DISCORD  MEDIA  SAVER   •  v1.0       ║
║     fotos & vídeos de um servidor inteiro    ║
╚══════════════════════════════════════════════╝

? Cole o token da conta (não aparece na tela): ********************
✔ Logado com sucesso como usuario#0000 (123456789012345678)

Seus servidores:
  111111111111111111  Meu Servidor (342 membros)

? ID do servidor: 111111111111111111
✔ Servidor selecionado: Meu Servidor
✔ 18 canais/threads encontrados
✔ Varredura concluída: 9.432 mensagens, 612 fotos/vídeos

Baixando 612 arquivos (3.1GB) → downloads/Meu_Servidor_111111111111111111

 Arquivo geral_987654321_foto.png          ████████████  100%
 Total   ████████████░░░░░░░░ 61.2% 375/612 1.9GB/3.1GB 5.2MB/s ETA 03:47
```

> ⚠️ **Antes de usar, leia a seção [Avisos legais e de segurança](#-avisos-legais-e-de-segurança) abaixo.**

---

## Índice

- [O que essa ferramenta faz](#o-que-essa-ferramenta-faz)
- [Por que estudar este projeto](#-por-que-estudar-este-projeto)
- [⚠️ Avisos legais e de segurança](#-avisos-legais-e-de-segurança)
- [Requisitos](#requisitos)
- [Instalação](#instalação)
- [Como pegar o token da conta](#como-pegar-o-token-da-conta)
- [Uso](#uso)
- [Onde os arquivos ficam salvos](#onde-os-arquivos-ficam-salvos)
- [Configuração (variáveis de ambiente)](#configuração-variáveis-de-ambiente)
- [Como funciona a retomada](#como-funciona-a-retomada)
- [Medidas de segurança implementadas](#medidas-de-segurança-implementadas)
- [Solução de problemas](#solução-de-problemas)
- [Estrutura do projeto](#estrutura-do-projeto)
- [Contribuindo](#contribuindo)
- [Licença](#licença)
- [Autor](#autor)

---

## O que essa ferramenta faz

1. Pede o **token** da sua conta do Discord (entrada oculta, nunca salvo em disco).
2. Faz login via [`discord.js-selfbot-v13`](https://www.npmjs.com/package/discord.js-selfbot-v13), uma biblioteca que permite automatizar uma **conta de usuário** (não um bot oficial).
3. Lista os servidores dessa conta e pede o **ID do servidor** a ser varrido.
4. Percorre **todos os canais de texto, canais de voz (chat), threads ativas/arquivadas e posts de fóruns**, lendo o histórico de mensagens.
5. Identifica todos os anexos que são **imagem ou vídeo** e baixa cada um, mostrando progresso por arquivo e progresso total (% , velocidade, ETA).
6. Salva tudo em **uma pasta só** por servidor, sem subpastas por canal.

---

## 📚 Por que estudar este projeto

Além de ser uma ferramenta funcional, o código foi escrito para servir de **material de estudo** para quem está aprendendo sobre:

- **API do Discord na prática**: autenticação, canais, threads, fóruns, anexos e rate limiting (HTTP 429).
- **Bots vs. selfbots**: a diferença entre automatizar uma aplicação oficial (bot token, intents, permissões) e automatizar uma conta de usuário (selfbot) — e por que a segunda é contra os Termos de Serviço.
- **Node.js assíncrono aplicado**: `async/await`, streams (`fetch` + `createWriteStream`), controle de concorrência e backoff em falhas de rede.
- **Engenharia de CLI**: barra de progresso, spinner, entrada oculta de senha/token no terminal, sem nenhuma dependência externa de UI.
- **Boas práticas de segurança em automações**: sanitização de entrada, allowlist de domínios, proteção contra path traversal, escrita atômica de arquivos e retomada idempotente.

Fique à vontade para abrir o `index.js` e ler os comentários — ele foi escrito para ser lido, não só executado.

---

## ⚠️ Avisos legais e de segurança

- **Isto é um selfbot.** Ele automatiza uma conta de usuário comum usando o token dela, e não um bot oficial criado no Portal de Desenvolvedores do Discord.
- **Isso viola os [Termos de Serviço do Discord](https://discord.com/terms)**, que proíbem automatizar contas de usuário. O uso é por sua conta e risco, e a conta usada pode ser **suspensa ou banida permanentemente**.
- Recomendado:
  - Usar uma **conta secundária**, nunca a sua principal.
  - **Nunca** compartilhar seu token com ninguém, nem colá-lo em chats, scripts versionados ou mensagens.
  - Só rodar isso em servidores em que você tem **permissão explícita** do dono/administradores para fazer esse backup. Baixar em massa fotos e vídeos de outras pessoas sem autorização pode violar leis de privacidade e direitos autorais no seu país.
- Este projeto é oferecido **sem garantias**. Os autores não se responsabilizam por banimentos de conta, perda de dados ou uso indevido.
- O token nunca é salvo em arquivo, impresso no terminal ou enviado a qualquer lugar além da API oficial do Discord (`discord.com`).

---

## Requisitos

- [Node.js](https://nodejs.org/) 18 ou mais recente (usa `fetch` nativo).
- Uma conta do Discord e o token dela.
- O ID do servidor que você quer salvar (a conta precisa já estar nesse servidor).

---

## Instalação

```bash
git clone https://github.com/victorpereiraetec/discord-media-saver.git
cd discord-media-saver
npm install
```

## Como pegar o token da conta

1. Abra o Discord **no navegador** (discord.com/app) e faça login.
2. Pressione `F12` para abrir o DevTools → aba **Network** (Rede).
3. Dê um refresh (F5) na página e clique em qualquer requisição feita para `discord.com/api/...`.
4. Nos **Request Headers**, copie o valor do campo `Authorization`. Esse é o seu token.
5. Guarde-o só para colar quando o programa pedir — **não** salve em arquivo texto nem envie para ninguém.

---

## Uso

```bash
npm start
```

O programa vai, em ordem:

1. Pedir o **token** (a digitação/colagem aparece como `*`).
2. Mostrar `✔ Logado com sucesso como usuario#0000 (id)`.
3. Listar os servidores da conta e pedir o **ID do servidor**.
4. Varrer todos os canais, mostrando quantas mensagens e mídias já encontrou.
5. Baixar tudo, mostrando progresso do arquivo atual e progresso total com % completo, velocidade e tempo estimado.
6. Exibir um **resumo final**: quantos arquivos foram baixados, quantos falharam (e por quê), e o caminho da pasta.

Para **interromper**, pressione `Ctrl+C`. É seguro: nenhum arquivo fica corrompido, e rodar `npm start` de novo **retoma de onde parou**, sem baixar nada duas vezes.

---

## Onde os arquivos ficam salvos

Tudo vai para a pasta `downloads/`, criada na raiz do projeto, numa **única subpasta por servidor**:

```
discord-media-saver/
└── downloads/
    └── Meu_Servidor_111111111111111111/
        ├── geral_987654321111111111_foto.png
        ├── geral_987654321222222222_video.mp4
        ├── memes_987654321333333333_gato.gif
        └── anuncios_987654321444444444_banner.jpg
```

- **Uma pasta só por servidor** — não há subpastas por canal.
- Cada nome de arquivo segue o padrão `canal_idDoAnexo_nomeOriginal.ext`, então dá pra saber de qual canal veio cada mídia só olhando o nome, e nunca há dois arquivos sobrescrevendo um ao outro.

Para mudar o local onde a pasta `downloads` é criada, use a variável `OUT_DIR` (veja a próxima seção).

---

## Configuração (variáveis de ambiente)

Todas são opcionais. Você pode defini-las na linha de comando ou criar um arquivo `.env` (já incluso no `.gitignore`, então nunca vai para o Git).

| Variável         | Padrão      | Descrição                                                              |
|------------------|-------------|--------------------------------------------------------------------------|
| `DISCORD_TOKEN`  | *(pede)*    | Se definida, pula a pergunta do token. **Cuidado**: evite deixar em histórico de shell. |
| `OUT_DIR`        | `downloads` | Pasta onde tudo é salvo.                                                |
| `MAX_FILE_MB`    | `500`       | Tamanho máximo por arquivo, em MB. Arquivos maiores são ignorados.      |

Exemplos:

```bash
# Linux / macOS
OUT_DIR=/home/usuario/MeuBackup MAX_FILE_MB=1000 npm start

# Windows (PowerShell)
$env:OUT_DIR="D:\DiscordBackup"; npm start

# Windows (CMD)
set OUT_DIR=D:\DiscordBackup && npm start
```

---

## Como funciona a retomada

Antes de baixar, o programa verifica se cada arquivo já existe na pasta de destino **com o mesmo tamanho** do original. Se sim, pula. Isso significa que:

- Rodar o programa várias vezes no mesmo servidor **não duplica downloads**.
- Se a internet cair ou você cancelar com `Ctrl+C`, é só rodar `npm start` de novo.
- Arquivos parcialmente baixados são gravados com extensão `.part` e só renomeados para o nome final quando o download termina com sucesso — então nunca sobra um arquivo corrompido com o nome final.

---

## Medidas de segurança implementadas

- **Token nunca é salvo em disco** nem exibido na tela (entrada oculta, mostra `*`).
- **Lista de domínios permitida**: só baixa de `cdn.discordapp.com` e `media.discordapp.net`, via HTTPS. Qualquer redirecionamento para outro domínio é bloqueado.
- **Sanitização de nomes de arquivo**: caracteres especiais são removidos, prevenindo nomes de arquivo maliciosos.
- **Proteção contra path traversal**: todo caminho de destino é validado para garantir que fica dentro da pasta `downloads`.
- **Filtro de tipo**: só baixa o que é imagem ou vídeo (por extensão e `Content-Type`), ignorando outros anexos.
- **Limite de tamanho** configurável (`MAX_FILE_MB`), para evitar encher o disco sem querer.
- **Escrita atômica**: grava em `.part` e só promove a arquivo final depois do download completo.
- **Pausas aleatórias** entre requisições e tratamento de rate limit (HTTP 429), para reduzir o risco de problemas com a conta.

Essas medidas protegem seu sistema e reduzem (mas não eliminam) o risco de uso da conta — o risco de banimento por violar os ToS do Discord continua existindo independentemente disso.

---

## Solução de problemas

**"Falha no login: token inválido."**
O token expirou ou foi copiado incorretamente. Pegue um novo seguindo [estas instruções](#como-pegar-o-token-da-conta).

**"A conta não está nesse servidor."**
Confirme o ID do servidor: clique com o botão direito no ícone do servidor no Discord (com o Modo Desenvolvedor ativado em Configurações → Avançado) e escolha "Copiar ID do Servidor".

**Vários arquivos na lista de "falharam" no resumo final**
Os links de anexos do Discord expiram depois de um tempo. Em servidores muito grandes, a varredura pode demorar e alguns links expirarem antes do download. Rode `npm start` de novo: ele retoma e baixa só o que faltou.

**"canais sem permissão de leitura foram pulados"**
A conta usada não tem acesso de leitura a esses canais. Isso é esperado e não é um erro — o programa simplesmente pula e continua.

---

## Estrutura do projeto

Todos os arquivos do projeto ficam numa única pasta (`downloads/` é criada à parte, em tempo de execução):

```
discord-media-saver/
├── index.js        # programa principal (toda a lógica, comentada)
├── package.json    # dependências e script "npm start"
├── .gitignore      # ignora downloads/, node_modules/ e .env
├── LICENSE         # MIT
└── README.md       # este arquivo
```

---

## Contribuindo

Sugestões, correções e melhorias são bem-vindas — é um projeto educacional, então PRs que melhorem clareza do código ou dos comentários têm prioridade.

1. Dê um fork no repositório.
2. Crie uma branch: `git checkout -b minha-melhoria`.
3. Commit: `git commit -m "Explica melhor a função X"`.
4. Push e abra um Pull Request.

Se encontrar um bug, abra uma [issue](../../issues) descrevendo o que aconteceu e, se possível, o erro exibido no terminal (sem colar o token, claro).

---

## Licença

Distribuído sob a licença MIT — use, modifique e distribua livremente, por sua conta e risco. Veja os [Avisos legais e de segurança](#-avisos-legais-e-de-segurança) acima.

---

## Autor

Feito por **[Victor Pereira](https://github.com/victorpereiraetec)**.

<p align="left">
  <a href="https://github.com/victorpereiraetec">
    <img src="https://img.shields.io/badge/GitHub-victorpereiraetec-181717?logo=github&logoColor=white" alt="GitHub @victorpereiraetec">
  </a>
</p>

Se este projeto te ajudou a entender melhor como a API do Discord funciona, considere deixar uma ⭐ no repositório.
