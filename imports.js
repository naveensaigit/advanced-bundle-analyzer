
// Tests for parseImports.js:getImports function

import 
defaultExport from 'module';

import {named1, named2 as alias2} from 'module';

import * as 
namespaceExport from
 'module';

import 
* 
as 
namespaceExport,
 {named1, 
    named2 
    as 
alias2} 
from 'module';

import          {named1
                , named2
 as alias2}
 , 
    * as 
    namespaceExport     from        'module';

import      
defaultExport      
, * as 
namespaceExport 
from 'module';

import defaultExport,     {named1, 
named2 as alias2} 
from 
'module';

import * as namespaceExport,      defaultExport
     from      'module';

import 
{named1, named2 as alias2},

defaultExport from 
'module';

import    
defaultExport            ,

*
as
namespaceExport, {named1   
, named2 as alias2, named3 as alias3} from 'module';

import

defaultExport
, {named1, named2 as alias2}, * as namespaceExport from 'module';

import 
* as namespaceExport       , defaultExport      ,
{named1, 
named2 as 
alias2} from 'module';

import * as namespaceExport,
{named1, named2 as alias2},
defaultExport from 'module';

import {named1, named2 as alias2}


,defaultExport
, * as namespaceExport from 'module';

import {named1, named2 as alias2}, * as namespaceExport
,

 defaultExport
from 
'module';