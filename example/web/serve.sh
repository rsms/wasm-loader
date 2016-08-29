#!/bin/sh
set -e
cd "$(dirname "$0")"

if [ "$1" = "-h" ] || [ "$1" = "-help" ] || [ "$1" = "--help" ]; then
  echo "Usage: $0 [h2]" >&2
  echo "  h2  Serve over HTTP/2 with TLS using caddy" >&2
  exit 1
fi

proto=$1

if [ "$proto" != "h2" ] && (which servedir >/dev/null); then
  servedir
elif (which caddy >/dev/null); then
  if [ "$proto" == "h2" ]; then
    certfile=self-signed-localhost.cert
    keyfile=self-signed-localhost.key
    if [ ! -f "$certfile" ]; then
      rm -f .csr.pem
      echo "generating TLS cert and key ($certfile, $keyfile)"
      openssl req \
        -nodes -newkey rsa:2048 \
        -keyout $keyfile \
        -sha256 \
        -out .csr.pem \
        -subj '/C=US/ST=California/L=San Francisco/O=/OU=/CN=localhost'
      openssl x509 -req -in .csr.pem -signkey $keyfile -out $certfile
      rm .csr.pem
      if (uname | grep -i darwin >/dev/null); then
        echo "Adding the cert to your keychain..."
        set +e # allow user to cancel this
        security add-trusted-cert -d -r trustRoot -k ~/Library/Keychains/login.keychain $certfile
        set -e
      fi
    fi

    # sudo security add-trusted-cert -d -r trustRoot -k /Library/Keychains/System.keychain /usr/local/etc/nginx/cert.pem
    caddy -host localhost "mime .ts text/typescript" "tls $certfile $keyfile"
  else
    caddy -host localhost "mime .ts text/typescript"
  fi
else
  echo "Can not find 'servedir' or 'caddy' in PATH." >&2
  echo "Install servedir from 'npm install -g secure-servedir', or"
  echo "install caddy from brew, apt or https://caddyserver.com/download"
  exit 1
fi
