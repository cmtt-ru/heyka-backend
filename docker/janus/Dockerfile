FROM debian:stretch

RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y --no-install-recommends build-essential \
        libmicrohttpd-dev \
        libjansson-dev \
        libnice-dev \
        libssl-dev \
        libsofia-sip-ua-dev \
        libglib2.0-dev \
        libopus-dev \
        libogg-dev \
        libini-config-dev \
        libcollection-dev \
        pkg-config \
        gengetopt \
        libtool \
        autotools-dev \
        automake \
        sudo \
        make \
        git \
        doxygen \
        graphviz \
        cmake \
        libconfig8-dev \
        ca-certificates \
    && apt-get clean && rm -rf /var/lib/apt/lists/*

RUN cd ~ \
    && git clone --branch v2.2.0 --single-branch https://github.com/cisco/libsrtp \
    && cd libsrtp \
    && ./configure --prefix=/usr --enable-openssl \
    && make shared_library \
    && sudo make install

RUN cd ~ \
    && git clone https://github.com/sctplab/usrsctp \
    && cd usrsctp \
    && ./bootstrap \
    && ./configure --prefix=/usr \
    && make \
    && sudo make install

RUN cd ~ \
    && git clone --branch v2.1.0 --single-branch https://github.com/warmcat/libwebsockets.git \
    && cd libwebsockets \
    && mkdir build \
    && cd build \
    && cmake -DCMAKE_INSTALL_PREFIX:PATH=/usr .. \
    && make \
    && sudo make install

RUN cd ~ \
    && git clone --branch v0.7.2 https://github.com/meetecho/janus-gateway.git \
    && cd janus-gateway \
    && sh autogen.sh \
    && ./configure --help \
    && ./configure --prefix=/opt/janus --disable-rabbitmq --disable-mqtt \
    --disable-websockets --disable-unix-sockets  --disable-nanomsg \
    --disable-plugin-echotest --disable-plugin-recordplay --disable-plugin-sip \
    --disable-plugin-sipre --disable-plugin-nosip --disable-plugin-streaming \
    --disable-plugin-videocall --disable-plugin-voicemail \
    && make CFLAGS='-std=c99' \
    && make install \
    && make configs

EXPOSE 7088 8088 8188
EXPOSE 10000-10200/udp

CMD /opt/janus/bin/janus --nat-1-1=${EXTERNAL_IP}