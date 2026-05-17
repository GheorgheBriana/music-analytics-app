FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

# Vite exposes the dev server on port 5173
EXPOSE 5173

CMD ["npm", "run", "dev", "--", "--host"]
