#!/usr/bin/env ruby
# frozen_string_literal: true

# Tests happy/unhappy del modelo de vistas del CV (fuente única _data/data.yml).
require "yaml"
require "pathname"
require "date"

ROOT = Pathname.new(__dir__).join("..").expand_path
DATA_FILE = ROOT.join("_data", "data.yml")
VIEWS = %w[mixto tecnico funcional].freeze

# Requisitos del cliente (escaneo ATS) que deben aparecer en la vista técnica.
ATS_KEYWORDS = [
  "Java",
  "Spring Boot",
  "Spring Framework",
  "Maven",
  "RESTful",
  "SQL",
  "NoSQL",
  "microservicios",
  "Agile",
  "redacción técnica",
  "AWS",
  "API Gateway",
  "Lambda",
].freeze

failures = []

def fail!(failures, msg)
  failures << msg
  warn "FAIL: #{msg}"
end

def ok(msg)
  puts "OK: #{msg}"
end

# --- Unhappy: archivo ausente / YAML inválido ---
unless DATA_FILE.file?
  fail!(failures, "no existe #{DATA_FILE}")
  warn "Tests abortados (#{failures.size} fallos)."
  exit 1
end

begin
  data = YAML.safe_load(DATA_FILE.read, permitted_classes: [Date], aliases: true)
rescue Psych::SyntaxError => e
  fail!(failures, "YAML inválido: #{e.message}")
  warn "Tests abortados (#{failures.size} fallos)."
  exit 1
end

unless data.is_a?(Hash)
  fail!(failures, "data.yml no es un mapa")
  exit 1
end

# --- Happy: catálogo de vistas ---
cv = data["cv"] || {}
view_ids = Array(cv["views"]).map { |v| v["id"] }
VIEWS.each do |view|
  if view_ids.include?(view)
    ok("vista registrada: #{view}")
  else
    fail!(failures, "falta vista '#{view}' en cv.views")
  end
end

default_view = cv["default_view"]
if VIEWS.include?(default_view)
  ok("default_view=#{default_view}")
else
  fail!(failures, "default_view inválido: #{default_view.inspect}")
end

# --- Happy: textos por vista ---
summary = data.dig("career-profile", "summary")
VIEWS.each do |view|
  text = summary.is_a?(Hash) ? summary[view] : nil
  if text.is_a?(String) && !text.strip.empty?
    ok("career-profile.summary.#{view} presente")
  else
    fail!(failures, "career-profile.summary.#{view} vacío o ausente")
  end
end

experiences = data.dig("experiences", "info") || []
if experiences.empty?
  fail!(failures, "experiences.info vacío")
else
  experiences.each_with_index do |exp, idx|
    details = exp["details"]
    VIEWS.each do |view|
      text = details.is_a?(Hash) ? details[view] : nil
      if text.is_a?(String) && !text.strip.empty?
        ok("experiences[#{idx}].details.#{view} presente")
      else
        fail!(failures, "experiences[#{idx}] (#{exp['company']}) sin details.#{view}")
      end
    end
  end
end

skills_core = data.dig("skills", "core")
VIEWS.each do |view|
  groups = skills_core.is_a?(Hash) ? skills_core[view] : nil
  if groups.is_a?(Array) && !groups.empty?
    ok("skills.core.#{view} con #{groups.size} grupos")
  else
    fail!(failures, "skills.core.#{view} vacío o ausente")
  end
end

# --- Happy: keywords ATS en vista técnica (corpus completo) ---
tecnico_corpus = []
tecnico_corpus << summary["tecnico"].to_s
experiences.each { |exp| tecnico_corpus << exp.dig("details", "tecnico").to_s }
tecnico_corpus << data.dig("skills", "intro", "tecnico").to_s
Array(skills_core["tecnico"]).each do |group|
  Array(group["items"]).each { |item| tecnico_corpus << item.to_s }
end
tecnico_text = tecnico_corpus.join("\n")

ATS_KEYWORDS.each do |kw|
  if tecnico_text.downcase.include?(kw.downcase)
    ok("ATS tecnico contiene #{kw.inspect}")
  else
    fail!(failures, "vista tecnico no contiene keyword ATS #{kw.inspect}")
  end
end

# --- Unhappy: keyword inventada no debe considerarse cubierta por error de lógica ---
fake = "TecnologíaInexistenteXYZ_#{Time.now.to_i}"
if tecnico_text.include?(fake)
  fail!(failures, "corpus tecnico contiene marcador falso inesperado")
else
  ok("unhappy: keyword falsa #{fake.inspect} no aparece (control negativo)")
end

# --- Unhappy: PDF path por vista ---
Array(cv["views"]).each do |v|
  if v["pdf"].to_s.end_with?(".pdf")
    ok("pdf de #{v['id']}: #{v['pdf']}")
  else
    fail!(failures, "vista #{v['id']} sin pdf válido")
  end
end

puts
if failures.empty?
  puts "Todos los tests de vistas OK."
  exit 0
else
  warn "#{failures.size} test(s) fallaron."
  exit 1
end
