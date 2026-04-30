# build and commit links page updates

# update the links page and commit
node generate-links.page.js 
git add --all
git commit -m"Update links"
git push origin main

# copy the index.html to the links folder and commit

# eof

