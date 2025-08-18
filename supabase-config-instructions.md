# Configuration Supabase pour système d'invitation natif

## 🎯 Configuration requise dans Supabase Dashboard

### 1. Authentication > URL Configuration

**Site URL :**
```
https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com
```

**Redirect URLs :**
```
https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com/auth/callback
https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com/**
https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com/auth/confirm
```

### 2. Authentication > Email Templates

**Configuration pour invitations :**
- Subject: `Invitation à rejoindre {{.SiteName}}`
- Redirect URL: `{{ .SiteURL }}/auth/callback?type=invite&token={{ .Token }}`

### 3. Authentication > Settings

**Confirmer les paramètres :**
- ✅ Enable email confirmations
- ✅ Enable email change confirmations  
- ✅ Enable secure email change
- ✅ Double confirm email changes

## 🔧 Variables d'environnement Supabase Functions

```bash
supabase secrets set SITE_URL=https://0815560b-83d3-424c-9aae-2424e8359352.lovableproject.com
```

## 📋 À faire après configuration

1. Tester une invitation avec un email de test
2. Vérifier que les redirections fonctionnent
3. Confirmer que les tokens sont valides
