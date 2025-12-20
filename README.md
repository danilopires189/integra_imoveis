# Etiqueta de Mercadoria - Hub de Etiquetas

Aplicação para geração de etiquetas de mercadoria com suporte a endereçamento de Pulmão e Separação, e inclusão opcional de validade.

## 🚀 Como usar (Deployment no GitHub Pages)

Para hospedar esta aplicação no GitHub Pages:

1.  Crie um novo repositório no GitHub.
2.  Faça o upload de todos os arquivos desta pasta (`etiqueta-mercadoria`).
3.  Vá em **Settings** > **Pages**.
4.  Em **Build and deployment**, escolha a branch `main` (ou a sua branch principal) e a pasta `/ (root)`.
5.  Clique em **Save**.
6.  Aguarde alguns minutos e o link da sua aplicação estará pronto.

## 💻 Desenvolvimento Local

Devido ao uso da API `fetch()` para carregar os bancos de dados (`.json`), o navegador bloqueia a execução se o arquivo `index.html` for aberto diretamente.

Para rodar localmente:
-   Use a extensão **Live Server** no VS Code.
-   Ou rode um servidor via terminal (ex: `python -m http.server`).

## 📁 Estrutura de Arquivos

-   `app.js`: Lógica principal da aplicação.
-   `index.html`: Interface do usuário.
-   `style.css`: Estilização.
-   `BASE_CADASTRO.json`: Banco de dados de produtos.
-   `BASE_END.json`: Banco de dados de endereços.
-   `pm.png` / `logo.png`: Logos da aplicação.

---
Desenvolvido por Danilo Pires.
