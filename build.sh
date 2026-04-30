# build and commit links page updates

# update the links page and commit
node generate-links-page.js 
git add --all
git commit -m"Update links"
git push origin main

# copy the index.html to the links folder and commit
cp index.html ../../../github-webs/01-active/mamund.github.io/links/
cd ../../../github-webs/01-active/mamund.github.io
# git add --all
# git commit -m"Update links"
# git push origin main

cd ../../../Private/Projects/2026-04-30/links-page

# eof

