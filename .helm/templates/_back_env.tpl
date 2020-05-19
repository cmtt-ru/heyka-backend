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
  value: "redis://ignored:$(S_REDIS_PASS)@{{ pluck .Values.global.env .Values.redis.host | first | default .Values.redis.host._default }}:{{ pluck .Values.global.env .Values.redis.port | first | default .Values.redis.port._default }}"
- name: PORT
  value: {{ .Values.backend.port | quote }}
- name: HOST
  value: "0.0.0.0"
- name: K8S_CLUSTER_HOST
  value: {{ pluck .Values.global.env .Values.kubernetes.host | first | default .Values.kubernetes.host._default }}
- name: K8S_JANUS_LABEL_SELECTOR
  value: {{ pluck .Values.global.env .Values.kubernetes.janus_node_label | first | default .Values.kubernetes.janus_node_label._default }}
{{ end }}
