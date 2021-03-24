'use strict';

const appmetrics = require('appmetrics');
const monitoring = appmetrics.monitor();
const ioMetrics = require('socket.io-prometheus');
const promRegister = require('prom-client').register;

let socketio = null;

const aggregatedMetrics = {
  cpu: {
    process: 0, // percentage of cpu used by backend itself
    system: 0, // percentage of cpu used by the system as a whole
  },
  eventloop_latency: { 
    min: 0, // shortest sampled latency
    max: 0, // longest sampled latency
    avg: 0
  },
  loop: {
    count: 0, // number of event loop ticks in last interval
    minimum: 0, // shortest tick
    maximum: 0, // longest tick
    average: 0, // average tick
    cpu_user: 0, // percentage of 1 CPU used by the event loop thread in user code the last interval
  },
  gc: {
    size: 0, // size of js heap in bytes
    used: 0, // memory used on the JS heap in bytes
    duration: 0, // the duration of the GC cycle
  },
  memory: {
    physical_total: 0,
    physical_used: 0,
    physical_free: 0,
    virtual: 0,
    private: 0,
    physical: 0,
  },
};

monitoring.on('cpu', cpu => copyObjectProperties(cpu, aggregatedMetrics.cpu));
monitoring.on('eventloop', eventloop => copyObjectProperties(eventloop.latency, aggregatedMetrics.eventloop_latency));
monitoring.on('loop', loop => copyObjectProperties(loop, aggregatedMetrics.loop));
monitoring.on('memory', memory => copyObjectProperties(memory, aggregatedMetrics.memory));
monitoring.on('gc', gc => copyObjectProperties(gc, aggregatedMetrics.gc));

exports.configureSocketIOMetrics = function configureSocketIOMetrics(io) {
  socketio = io;
  ioMetrics(socketio);
};

exports.getAppMetrics = function () {
  let result = promRegister.metrics();

  // cpu.process
  result += '\n# HELP cpu_process The percentage of CPU used by the Node.js application itself.';
  result += '\n# TYPE cpu_process gauge';
  result += `\ncpu_process ${aggregatedMetrics.cpu.process}\n`;

  // cpu.process
  result += '\n# HELP cpu_system The percentage of CPU used by the system as a whole';
  result += '\n# TYPE cpu_system gauge';
  result += `\ncpu_system ${aggregatedMetrics.cpu.system}\n`;

  // eventloop_latency_min
  result += '\n# HELP eventloop_latency_min The shortest sampled latency';
  result += '\n# TYPE eventloop_latency_min gauge';
  result += `\neventloop_latency_min ${aggregatedMetrics.eventloop_latency.min}\n`;

  // eventloop_latency_max
  result += '\n# HELP eventloop_latency_max The longest sampled latency';
  result += '\n# TYPE eventloop_latency_max gauge';
  result += `\neventloop_latency_max ${aggregatedMetrics.eventloop_latency.max}\n`;

  // eventloop_latency_avg
  result += '\n# HELP eventloop_latency_avg The average sampled latency';
  result += '\n# TYPE eventloop_latency_avg gauge';
  result += `\neventloop_latency_avg ${aggregatedMetrics.eventloop_latency.avg}\n`;

  // loop_count
  result += '\n# HELP loop_count the number of event loop ticks in the last interval';
  result += '\n# TYPE loop_count gauge';
  result += `\nloop_count ${aggregatedMetrics.loop.count}\n`;

  // loop_minimum
  result += '\n# HELP loop_minimum the shortest (i.e. fastest) tick in milliseconds';
  result += '\n# TYPE loop_minimum gauge';
  result += `\nloop_minimum ${aggregatedMetrics.loop.minimum}\n`;

  // loop_maximum
  result += '\n# HELP loop_maximum the longest (slowest) tick in milliseconds.';
  result += '\n# TYPE loop_maximum gauge';
  result += `\nloop_maximum ${aggregatedMetrics.loop.maximum}\n`;

  // loop_average
  result += '\n# HELP loop_average the average tick time in milliseconds.';
  result += '\n# TYPE loop_average gauge';
  result += `\nloop_average ${aggregatedMetrics.loop.average}\n`;

  // loop_cpu_user
  // eslint-disable-next-line
  result += '\n# HELP loop_cpu_user the percentage of 1 CPU used by the event loop thread in user code the last interval';
  result += '\n# TYPE loop_cpu_user gauge';
  result += `\nloop_cpu_user ${aggregatedMetrics.loop.cpu_user}\n`;

  // gc_size
  result += '\n# HELP gc_size the size of the JavaScript heap in bytes';
  result += '\n# TYPE gc_size gauge';
  result += `\ngc_size ${aggregatedMetrics.gc.size}\n`;

  // gc_used
  result += '\n# HELP gc_used the amount of memory used on the JavaScript heap in bytes';
  result += '\n# TYPE gc_used gauge';
  result += `\ngc_used ${aggregatedMetrics.gc.used}\n`;

  // gc_duration
  result += '\n# HELP gc_duration the duration of the GC cycle in milliseconds';
  result += '\n# TYPE gc_duration gauge';
  result += `\ngc_duration ${aggregatedMetrics.gc.duration}\n`;

  // memory_physical_total
  result += '\n# HELP memory_physical_total the total amount of RAM available on the system in bytes';
  result += '\n# TYPE memory_physical_total gauge';
  result += `\nmemory_physical_total ${aggregatedMetrics.memory.physical_total}\n`;

  // memory_physical_used
  result += '\n# HELP memory_physical_used the total amount of RAM in use on the system in bytes';
  result += '\n# TYPE memory_physical_used gauge';
  result += `\nmemory_physical_used ${aggregatedMetrics.memory.physical_used}\n`;

  // memory_physical_free
  result += '\n# HELP memory_physical_free the total amount of free RAM available on the system in bytes';
  result += '\n# TYPE memory_physical_free gauge';
  result += `\nmemory_physical_free ${aggregatedMetrics.memory.physical_free}\n`;

  // memory_virtual
  result += '\n# HELP memory_virtual the memory address space used by the Node.js application in bytes';
  result += '\n# TYPE memory_virtual gauge';
  result += `\nmemory_virtual ${aggregatedMetrics.memory.virtual}\n`;

  // memory_private
  // eslint-disable-next-line
  result += '\n# HELP memory_private the amount of memory used by the Node.js application that cannot be shared with other processes';
  result += '\n# TYPE memory_private gauge';
  result += `\nmemory_private ${aggregatedMetrics.memory.private}\n`;

  // memory_physical
  result += '\n# HELP memory_physical the amount of RAM used by the Node.js application in bytes';
  result += '\n# TYPE memory_physical gauge';
  result += `\nmemory_physical ${aggregatedMetrics.memory.physical}\n`;

  return result;
};

function copyObjectProperties (source, dest) {
  Object.keys(dest).forEach(key => {
    dest[key] = source[key];
  });
}
