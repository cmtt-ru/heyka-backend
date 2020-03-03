FROM node:alpine

WORKDIR /app
RUN yarn

EXPOSE 5000

CMD yarn run migrate up ; yarn run dev
