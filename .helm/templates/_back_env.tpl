{{ define "backend_env" }}
- name: S_DATABASE_USER
  valueFrom:
    configMapKeyRef:
      name: postgres-config
      key: user
- name: S_DATABASE_PASSWORD
  valueFrom:
    configMapKeyRef:
      name: postgres-config
      key: password
- name: S_DATABASE_NAME
  valueFrom:
    configMapKeyRef:
      name: postgres-config
      key: db
- name: S_REDIS_PASS
  valueFrom:
    configMapKeyRef:
      name: redis-config
      key: password
- name: DATABASE_URL
  value: "postgres://$(S_DATABASE_USER):$(S_DATABASE_PASSWORD)@{{ pluck .Values.global.env .Values.postgres.host | first | default .Values.postgres.host._default }}:{{ pluck .Values.global.env .Values.postgres.port | first | default .Values.postgres.port._default }}/$(S_DATABASE_NAME)"
- name: REDIS_URI
  value: "redis://:$(S_REDIS_PASS)@{{ pluck .Values.global.env .Values.redis.host | first | default .Values.redis.host._default }}:{{ pluck .Values.global.env .Values.redis.port | first | default .Values.redis.port._default }}"
- name: PORT
  value: {{ .Values.app.port | quote }}
- name: HOST
  value: "0.0.0.0"
{{- if (pluck .Values.global.env .Values.janus.kubernetes.enabled | first | default .Values.janus.kubernetes.enabled._default) }}
- name: K8S_CLUSTER_HOST
  value: {{ pluck .Values.global.env .Values.janus.kubernetes.host | first | default .Values.janus.kubernetes.host._default }}
- name: K8S_JANUS_LABEL_SELECTOR
  value: {{ pluck .Values.global.env .Values.janus.kubernetes.janus_node_label | first | default .Values.janus.kubernetes.janus_node_label._default }}
{{- end }}
{{- if (pluck .Values.global.env .Values.janus.external.enabled | first | default .Values.janus.external.enabled._default) }}
- name: DEFAULT_JANUS_URL
  value: {{ pluck .Values.global.env .Values.janus.external.url | first | default .Values.janus.external.url._default }}
- name: DEFAULT_PUBLIC_JANUS_URL
  value: {{ pluck .Values.global.env .Values.janus.external.public_url | first | default .Values.janus.external.public_url._default }}
{{- end }}
- name: PUBLIC_HOSTNAME
  value: {{ pluck .Values.global.env .Values.app.url | first | default (printf "back-%s.%s" .Values.global.env .Values.app.domain_base) }}
- name: DEPLOYMENT_ENV
  value: {{ .Values.global.env }}
{{ end }}

{{ define "backend_env_watcher" }}
- name: S_DATABASE_USER
  valueFrom:
    configMapKeyRef:
      name: postgres-config
      key: user
- name: S_DATABASE_PASSWORD
  valueFrom:
    configMapKeyRef:
      name: postgres-config
      key: password
- name: S_DATABASE_NAME
  valueFrom:
    configMapKeyRef:
      name: postgres-config
      key: db
- name: S_REDIS_PASS
  valueFrom:
    configMapKeyRef:
      name: redis-config
      key: password
- name: DATABASE_URL
  value: "postgres://$(S_DATABASE_USER):$(S_DATABASE_PASSWORD)@{{ pluck .Values.global.env .Values.postgres.host | first | default .Values.postgres.host._default }}:{{ pluck .Values.global.env .Values.postgres.port | first | default .Values.postgres.port._default }}/$(S_DATABASE_NAME)"
- name: REDIS_URI
  value: "redis://:$(S_REDIS_PASS)@{{ pluck .Values.global.env .Values.redis.host | first | default .Values.redis.host._default }}:{{ pluck .Values.global.env .Values.redis.port | first | default .Values.redis.port._default }}"
{{- if (pluck .Values.global.env .Values.janus.kubernetes.enabled | first | default .Values.janus.kubernetes.enabled._default) }}
- name: K8S_CLUSTER_HOST
  value: {{ pluck .Values.global.env .Values.janus.kubernetes.host | first | default .Values.janus.kubernetes.host._default }}
- name: K8S_JANUS_LABEL_SELECTOR
  value: {{ pluck .Values.global.env .Values.janus.kubernetes.janus_node_label | first | default .Values.janus.kubernetes.janus_node_label._default }}
{{- end }}
{{- if (pluck .Values.global.env .Values.janus.external.enabled | first | default .Values.janus.external.enabled._default) }}
- name: DEFAULT_JANUS_URL
  value: {{ pluck .Values.global.env .Values.janus.external.url | first | default .Values.janus.external.url._default }}
- name: DEFAULT_PUBLIC_JANUS_URL
  value: {{ pluck .Values.global.env .Values.janus.external.public_url | first | default .Values.janus.external.public_url._default }}
{{- end }}
- name: CLOUDFLARE_DNS_ZONE_ID
  value: {{ pluck .Values.global.env .Values.app.cloudflare.zone_id | first | default .Values.app.cloudflare.zone_id._default }}
- name: CLOUDFLARE_DNS_APIKEY
  value: {{ pluck .Values.global.env .Values.app.cloudflare.dns_apikey | first | default .Values.app.cloudflare.dns_apikey._default }}
{{ end }}