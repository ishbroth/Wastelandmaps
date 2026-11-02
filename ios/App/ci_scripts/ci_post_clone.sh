#!/bin/sh
# Xcode Cloud runs this right after it checks the repository out. The web build that the app wraps (ios/App/App/public) is not kept in git, so it is made here:
# install Node, install the packages, build the site and copy it into the iOS project (Capacitor 8 uses Swift Package Manager: there is no pod install).
#
# Needs two environment variables on the Xcode Cloud workflow (App Store Connect > the app > Xcode Cloud > the workflow > Environment), the second one as a secret:
#   VITE_GOOGLE_MAPS_API_KEY   the Google key for the app (restricted by API only, not by website)
#   VITE_SUPABASE_ANON_KEY     the Supabase anon key
set -e

cd "$CI_PRIMARY_REPOSITORY_PATH"

# Node (Xcode Cloud's Macs have Homebrew)
brew install node@22
export PATH="$(brew --prefix node@22)/bin:$PATH"
node --version

npm ci

# the site reads its keys from the environment at build time
printf 'VITE_GOOGLE_MAPS_API_KEY=%s\nVITE_SUPABASE_ANON_KEY=%s\n' "$VITE_GOOGLE_MAPS_API_KEY" "$VITE_SUPABASE_ANON_KEY" > .env.local

npm run build
npx cap sync ios
