FROM node:20

WORKDIR /app

COPY package*.json ./
COPY scripts/ ./scripts/

RUN npm ci --ignore-scripts

COPY . .

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "--host"]