FROM registry.cn-hangzhou.aliyuncs.com/rcmirrors/nginx:1.19.8-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY dist/ /usr/share/nginx/html/

EXPOSE 80

