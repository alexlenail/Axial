from setuptools import setup

setup(
    name='axial',
    packages=['axial'],
    package_data={'axial': ['axial/templates/*', 'axial/go/*']},
    version='0.0.3',
    url='https://github.com/zfrenchee/axial',
    classifiers=[
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7'],
    license='MIT',
    author='zfrenchee',
    author_email='alex@lenail.org',
    description='',
    install_requires=[],
)

