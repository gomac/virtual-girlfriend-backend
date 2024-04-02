FROM node
WORKDIR /app
COPY package.json /app
RUN yarn
COPY . /app
#RUN apt-get -y update && apt-get -y upgrade && apt-get install -y ffmpeg
#RUN apt-get -y update && apt-get install -y ffmpeg
CMD node index.js
EXPOSE 3000
