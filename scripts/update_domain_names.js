'use strict';

const createServer = require('../server');
const config = require('../config');
const cf = require('cloudflare')({
  token: config.cloudflare.dnsAPIKey,
});
const JSONStream = require('json-stream');

async function startWatcher () {
  try {
    const server = await createServer();

    const {
      janusWorkspaceService,
    } = server.services();

    // collect janus nodes
    const nodes = (await janusWorkspaceService.fetchJanusNodes()).map(node => ({
      ip: node.status.addresses.find(address => address.type === 'ExternalIP').address
    }));
    // collect all dns-records
    const dnsRecords = (await cf.dnsRecords.browse(config.cloudflare.dnsZoneId)).result
      .filter(record => record.type === 'A' && record.name.includes('.infr.heyka.io'));

    // check domain that should be added
    await Promise.all(
      nodes.map(async janusNode => {
        const domainName = janusWorkspaceService.getJanusDomainName(janusNode.ip);
        
        // check if domain name should be added
        if (!dnsRecords.find(record => record.name === domainName)) {
          await cf.dnsRecords.add(config.cloudflare.dnsZoneId, {
            type: 'A',
            name: domainName,
            content: janusNode.ip,
            ttl: 120,
          });
          console.log(`DNS record for ${janusNode.ip} has been added (${domainName})`);
        }
      })
    );

    // check domain that should be deleted
    await Promise.all(
      dnsRecords.map(async record => {
        if (!nodes.find(node => node.ip === record.content)) {
          await cf.dnsRecords.del(config.cloudflare.dnsZoneId, record.id);
          console.log(`DNS record for ${record.content} has been added (${record.name})`);
        }
      })
    );

    // subscribe for further changes
    const janusStream = await janusWorkspaceService.getNodeUpdatesStream();
    if (janusStream) {
      const jsonJanusStream = new JSONStream();
      janusStream.pipe(jsonJanusStream);
      jsonJanusStream.on('data', object => {
        console.log('Event: ', JSON.stringify(object, null, 2));
      });
      jsonJanusStream.on('error', err => {
        console.error(err);
        process.exit(1);
      });
    }

    server.start();  
    server.log(['info'], 'Script started');
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

startWatcher();
