FROM registry.cn-hangzhou.aliyuncs.com/rcmirrors/nginx:1.19.8-alpine

RUN rm -rf /usr/share/nginx/html/*
COPY nginx.conf /etc/nginx/conf.d/default.conf
COPY dist/ /usr/share/nginx/html/app/agents/

EXPOSE 80

