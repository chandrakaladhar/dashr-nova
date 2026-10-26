{{- define "dashr-nova.name" -}}
{{- default .Chart.Name .Values.nameOverride | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "dashr-nova.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- include "dashr-nova.name" . -}}
{{- end -}}
{{- end -}}

{{- define "dashr-nova.selectorLabels" -}}
app.kubernetes.io/name: {{ include "dashr-nova.name" . }}
app.kubernetes.io/instance: {{ .Release.Name }}
{{- end -}}

{{- define "dashr-nova.labels" -}}
{{ include "dashr-nova.selectorLabels" . }}
app.kubernetes.io/version: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
app.kubernetes.io/managed-by: {{ .Release.Service }}
helm.sh/chart: {{ printf "%s-%s" .Chart.Name .Chart.Version | replace "+" "_" }}
{{- end -}}

{{- define "dashr-nova.serviceAccountName" -}}
{{- if .Values.serviceAccount.create -}}
{{- default (include "dashr-nova.fullname" .) .Values.serviceAccount.name -}}
{{- else -}}
{{- default "default" .Values.serviceAccount.name -}}
{{- end -}}
{{- end -}}

{{- define "dashr-nova.image" -}}
{{- if .Values.image.digest -}}
{{ .Values.image.repository }}@{{ .Values.image.digest }}
{{- else -}}
{{ .Values.image.repository }}:{{ required "\n\nimage.tag is required. Set the version to deploy (the deploy repo overlay normally does this)." .Values.image.tag }}
{{- end -}}
{{- end -}}

{{/*
Dependency contract -> environment variables read by lib/config.ts.
Fails the install with a message saying what to set if a dependency is missing.
*/}}
{{- define "dashr-nova.dependencyEnv" -}}
{{- $db := .Values.database -}}
{{- if $db.existingSecret }}
- name: DATABASE_URL
  valueFrom:
    secretKeyRef:
      name: {{ $db.existingSecret }}
      key: {{ $db.existingSecretKey }}
{{- else if $db.url }}
- name: DATABASE_URL
  value: {{ $db.url | quote }}
{{- else }}
{{- fail "\n\nPostgreSQL is not configured.\nSet database.existingSecret (recommended: a Secret whose key database.existingSecretKey holds the connection string)\nor database.url (dev/trials only).\nSee the chart README, section Dependencies, and examples/." }}
{{- end }}
- name: DB_POOL_MAX
  value: {{ $db.poolMax | quote }}
- name: TEMPORAL_ENABLED
  value: {{ .Values.temporal.enabled | quote }}
{{- if .Values.temporal.enabled }}
- name: TEMPORAL_ADDRESS
  value: {{ required "\n\ntemporal.address is required when temporal.enabled=true.\nSet it to the Temporal frontend as host:port, or set temporal.enabled=false." .Values.temporal.address | quote }}
- name: TEMPORAL_NAMESPACE
  value: {{ .Values.temporal.namespace | quote }}
{{- end }}
- name: OPA_ENABLED
  value: {{ .Values.opa.enabled | quote }}
{{- if .Values.opa.enabled }}
- name: OPA_URL
  value: {{ required "\n\nopa.url is required when opa.enabled=true.\nSet it to the OPA REST API base URL (e.g. http://opa:8181), or set opa.enabled=false." .Values.opa.url | quote }}
- name: OPA_POLICY_PATH
  value: {{ .Values.opa.policyPath | quote }}
{{- end }}
{{- end -}}

{{- define "dashr-nova.env" -}}
{{- $_ := required "\n\nenv.APP_ENV is required (local, development, staging, production...).\nOnly local and development accept development identities. The deploy repo overlay normally sets it." .Values.env.APP_ENV }}
{{- range $k, $v := .Values.env }}
- name: {{ $k }}
  value: {{ $v | quote }}
{{- end }}
- name: APP_VERSION
  value: {{ .Values.image.tag | default .Chart.AppVersion | quote }}
{{ include "dashr-nova.dependencyEnv" . }}
{{- end -}}

{{/* Human-readable description of where each dependency comes from (NOTES.txt). */}}
{{- define "dashr-nova.dependencySummary" -}}
{{- if .Values.database.existingSecret -}}
PostgreSQL : Secret {{ .Values.database.existingSecret }}, key {{ .Values.database.existingSecretKey }}
{{- else -}}
PostgreSQL : database.url (given directly; use existingSecret outside dev)
{{- end }}
{{ if .Values.temporal.enabled -}}
Temporal   : {{ .Values.temporal.address }} (namespace {{ .Values.temporal.namespace }})
{{- else -}}
Temporal   : disabled
{{- end }}
{{ if .Values.opa.enabled -}}
OPA        : {{ .Values.opa.url }}/v1/data/{{ .Values.opa.policyPath }}
{{- else -}}
OPA        : disabled
{{- end }}
{{- end -}}
