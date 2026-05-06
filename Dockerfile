FROM node:20-alpine AS builder

WORKDIR /app

ARG VITE_API_BASE_URL
ARG VITE_ADMIN_TOKEN
ARG VITE_TENANT_ID
ARG VITE_VACANCY_ID

ENV VITE_API_BASE_URL=$VITE_API_BASE_URL
ENV VITE_ADMIN_TOKEN=$VITE_ADMIN_TOKEN
ENV VITE_TENANT_ID=$VITE_TENANT_ID
ENV VITE_VACANCY_ID=$VITE_VACANCY_ID

COPY package.json package-lock.json* ./
RUN npm install

COPY . .

RUN echo "VITE_API_BASE_URL=$VITE_API_BASE_URL"
RUN echo "VITE_TENANT_ID=$VITE_TENANT_ID"
RUN echo "VITE_VACANCY_ID=$VITE_VACANCY_ID"
RUN test -n "$VITE_API_BASE_URL"

RUN npm run build

FROM nginx:alpine

RUN rm -f /etc/nginx/conf.d/default.conf

COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]