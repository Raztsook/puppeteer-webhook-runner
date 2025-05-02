FROM node:20-slim

# תוספות שדרושות בשביל Puppeteer לעבוד בענן
RUN apt-get update && apt-get install -y \
    wget \
    ca-certificates \
    fonts-liberation \
    libappindicator3-1 \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libcups2 \
    libdbus-1-3 \
    libgdk-pixbuf2.0-0 \
    libnspr4 \
    libnss3 \
    libx11-xcb1 \
    libxcomposite1 \
    libxdamage1 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    libxss1 \
    libnss3-tools \
    libxshmfence1 \
    libxfixes3 \
    --no-install-recommends \
 && apt-get clean \
 && rm -rf /var/lib/apt/lists/*

# העתקת קבצים והתקנת תלויות
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .

# האפליקציה מאזינה על הפורט הזה
ENV PORT=8080

# הפקודה שתפעיל את השרת
CMD ["npm", "start"]
