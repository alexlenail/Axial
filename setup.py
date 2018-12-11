from setuptools import setup

setup(
    name='axial',
    packages=['axial'],
    package_data={'axial': ['templates/*', 'go/*']},
    version='0.1.0',
    url='https://github.com/zfrenchee/axial',
    classifiers=[
        'Programming Language :: Python :: 3.5',
        'Programming Language :: Python :: 3.6',
        'Programming Language :: Python :: 3.7'],
    license='MIT',
    author='zfrenchee',
    author_email='alex@lenail.org',
    description='Interactive Visualizations for High Dimensional Genomics Data',
    install_requires=[
        "pandas>=0.23.4",
        "networkx>=2.1",
        "requests",
        "jinja2",
    ],
)

