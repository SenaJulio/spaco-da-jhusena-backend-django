from django.apps import apps

for app in apps.get_app_configs():
    print(app.name)
