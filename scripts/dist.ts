{
  const { join } = require('path');
  const { writeFileSync } = require('fs');
  const FLAVORS = ['rtdb', 'firestore', 'mod-rtdb', 'mod-firestore'];

  let flavor = process.argv[2];
  if (!flavor || !FLAVORS.includes(flavor)) {
    flavor = FLAVORS[0];
  }

  const pkg = require(join(__dirname, '..', 'package.json'));

  const distPkg = {
    name: pkg.name,
    author: pkg.author,
    license: pkg.license,
    repository: pkg.repository,
    main: 'lib/index.js',
    engines: pkg.engines,
    dependencies: pkg.dependencies,
    private: pkg.private
  };

  if (flavor.startsWith('mod-')) {
    distPkg.name += '-' + flavor.substr(4);
  } else {
    distPkg.name += '-standalone-' + flavor;
  }

  writeFileSync(
    join(__dirname, '..', 'dist', flavor, 'package.json'),
    JSON.stringify(distPkg, null, 2)
  );
}
