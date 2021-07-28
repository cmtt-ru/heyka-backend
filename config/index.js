'use strict';

require('dotenv').config();

module.exports = {
  port: process.env.PORT || 5000,
  host: process.env.HOST || '0.0.0.0',
  jwtSecret: process.env.JWT_SECRET || 'default_jwt_token',
  publicHostname: process.env.DEPLOYMENT_ENV === 'stage'
    ? 'heyka.app'
    : process.env.DEPLOYMENT_ENV ? 'web-dev.dev.k8s.heyka.io' : 'localhost:8080',
  leonardo: {
    uploadUrl: process.env.LEONARDO_UPLOAD_URL || 'https://leonardo-direct.osnova.io/upload/files/',
    staticServerUrl: process.env.LEONARDO_STATIC_SERVER_URL || 'https://leonardo.osnova.io/',
  },
  cloudflare: {
    dnsZoneId: process.env.CLOUDFLARE_DNS_ZONE_ID || '6d1bd449e01e1f096e86188632ab55d1',
    dnsAPIKey: process.env.CLOUDFLARE_DNS_APIKEY || 'cloudflare-api-key',
  },
  credentials: {
    cookiePassword: process.env.COOKIE_PASSWORD || 'cookie-password',
    google: {
      clientId: process.env.GOOGLE_CLIENT_ID || 'google-client-id',
      clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'google-client-secret'
    },
    slack: {
      clientId: process.env.SLACK_CLIENT_ID || 'slack-client-id',
      clientSecret: process.env.SLACK_CLIENT_SECRET || 'slack-client-secret',
      verificationToken: process.env.SLACK_VERIFICATION_TOKEN || 'slack-verification-token'
    },
    facebook: {
      clientId: process.env.FACEBOOK_CLIENT_ID || 'facebook-client-id',
      clientSecret: process.env.FACEBOOK_CLIENT_SECRET || 'facebook-client-secret'
    },
    mailgun: {
      domain: process.env.MAILGUN_DOMAIN || 'mailgun-domain',
      apikey: process.env.MAILGUN_APIKEY || 'mailgun-apikey',
    },
    mailchimp: {
      apikey: process.env.MAILCHIMP_APIKEY || 'mailchimp-apikey',
      endpoint: 'https://us20.api.mailchimp.com/3.0/',
      audienceName: 'Heyka release',
      audienceId: 'fdd8523428',
    }
  },
  redis: process.env.SENTINELS ? {
    sentinels: process.env.SENTINELS
      .split(',')
      .map(item => ({
        host: item.split(':')[0],
        port: parseInt(item.split(':')[1], 10)
      })),
    name: 'mymaster',
    sentinelPassword: process.env.SENTINEL_PASSWORD
  } : {
    uri: process.env.REDIS_URI || 'redis://127.0.0.1:6379'
  },
  pg: {
    uri: process.env.DATABASE_URL || 'postgres://pg:strongpassword@localhost:5432/heyka'
  },
  janus: {
    defaultJanusUrl: process.env.DEFAULT_JANUS_URL || 'http://localhost',
    defaultPublicJanusUrl: process.env.DEFAULT_PUBLIC_JANUS_URL || 'http://localhost',
    k8sClusterHost: process.env.K8S_CLUSTER_HOST || null,
    k8sJanusLabelSelector: process.env.K8S_JANUS_LABEL_SELECTOR || null
  },
  files: {
    awsEndpoint: process.env.AWS_ENDPOINT || 'aws_endpoint',
    awsBucket: process.env.AWS_BUCKET || 'aws_bucket',
    awsLogsBucket: 'heyka-logs',
    awsKey: process.env.AWS_KEY || 'aws_key',
    awsSecret: process.env.AWS_SECRET || 'aws_secret',
    imgproxyUrl: process.env.IMGPROXY_URL || 'imgproxy_url',
    imgproxyKey: process.env.IMGPROXY_KEY || 'imgporxy_key',
    imgproxySalt: process.env.IMGPROXY_SALT || 'imgproxy_salt',
    limitPerUser: 100,
  },
  notificationService: {
    awsKey: process.env.AWS_SNS_KEY,
    awsSecret: process.env.AWS_SNS_SECRET,
    appleArn: process.env.AWS_SNS_APPLE_ARN,
    androidArn: process.env.AWS_SNS_ANDROID_ARN,
    awsEndpoint: process.env.AWS_SNS_ENDPOINT,
  },
  limitOfChannelMembers: 3
};
