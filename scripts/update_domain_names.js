'use strict';

const createServer = require('../server');
const config = require('../config');
const cf = require('cloudflare')({
  token: config.cloudflare.dnsAPIKey,
});
const SYNC_INTERVAL = 60 * 1000;

async function syncDomainNamesWithJanusNodes(janusWorkspaceService) {
  // collect janus nodes
  const nodes = (await janusWorkspaceService.fetchJanusNodes()).map(node => ({
    ip: node.status.addresses.find(address => address.type === 'ExternalIP').address
  }));
    // collect all dns-records
  const dnsRecords = (await cf.dnsRecords.browse(config.cloudflare.dnsZoneId)).result
    .filter(record => record.type === 'A' && record.name.includes('.infr.heyka.io'));

  console.log(`Collected all janus nodes`, dnsRecords);

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

  console.log(`Added domain name servers`);

  // check domain that should be deleted
  await Promise.all(
    dnsRecords.map(async record => {
      if (!nodes.find(node => node.ip === record.content)) {
        await cf.dnsRecords.del(config.cloudflare.dnsZoneId, record.id);
        console.log(`DNS record for ${record.content} has been added (${record.name})`);
      }
    })
  );

  console.log(`Deleted domain name servers`);
}

async function startWatcher () {
  try {
    const server = await createServer();
    
    console.log(`Server created`);

    const {
      janusWorkspaceService,
    } = server.services();

    await syncDomainNamesWithJanusNodes(janusWorkspaceService);

    let processing = false;
    setTimeout(async () => {
      if (!processing) {
        processing = true;
        await syncDomainNamesWithJanusNodes(janusWorkspaceService);
        processing = false;
      }
    }, SYNC_INTERVAL);

    server.start();
    
    console.log(`Server started at ${server.info.uri}`);
  } catch(e) {
    console.error(e);
    process.exit(1);
  }
}

startWatcher();
