clean:
	rm -rf ./app/node_modules
	rm -rf ./node_modules

ensure:
	yarn --cwd app install
	yarn install

serve:
	yarn --cwd app develop

new-stack:
	pulumi stack init

preview:
	pulumi preview

deploy:
	pulumi up --yes

browse:
	open "$(shell pulumi stack output url)"

logs:
	pulumi logs -f

destroy:
	pulumi destroy --yes
