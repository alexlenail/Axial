### Pypi

```
rm -rf build dist axial.egg-info && python setup.py sdist bdist_wheel && twine upload dist/*
```

### NPM

```
npm publish
```

### Docs

```
cd docs && source ../venv/bin/activate && make html
```


