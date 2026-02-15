# ==========================================
# STAGE 1: Build the React App
# ==========================================
# Updated to Node 24 to match your local environment
FROM node:24-alpine as build

WORKDIR /app

# Copy package files first to leverage Docker cache
COPY package*.json ./
RUN npm install

# Copy source code
COPY . .

# Build Argument for API URL
# We default to localhost for browser access, but this can be overridden
ARG VITE_API_URL=http://localhost:5000
ENV VITE_API_URL=$VITE_API_URL

# Compile TypeScript -> Static HTML/JS (Output goes to /app/dist)
RUN npm run build

# ==========================================
# STAGE 2: Serve with Nginx
# ==========================================
FROM nginx:alpine

# Copy the custom Nginx config (Must exist in web-client folder!)
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy the built static files from Stage 1 to Nginx
COPY --from=build /app/dist /usr/share/nginx/html

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]