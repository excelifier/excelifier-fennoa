FROM node:21

# Create app directory
WORKDIR /app

# Install app dependencies
COPY package*.json yarn.lock ./
RUN yarn

# Bundle app source
COPY . .

# Build TypeScript to JavaScript
RUN yarn build

EXPOSE 8080
CMD [ "node", "dist/index.js" ]