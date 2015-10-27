d3.egoNetworks = function module() {
  var attrs = {
    width: 600,
    height:600,
    egoIndex:0,
    nodeKey:'index',
    degreeMin:1,
    degreeMax:10,
    valueKey:'value', //null 이면 갯수로 센다.
    sortKey:'value', // sortKey가 ordinal 인지 linear 인지
    sortType:'number',
    nameKey:'ent_name',
    sortAscending : false,
    sortUnit : 1,
    isDirected : false,
    hierKeys : ['team', 'company'],
    colorKey : ['company']
  }
  var margin = {top:40, right:40, bottom:40, left:40}
  var debug = false, sorted = false, durationUnit = 400;
  var size = d3.scale.linear(), color = d3.scale.category20();
  var innerWidth, innerHeight, netRadius, minRadius, maxRadius;
  var sortRadius = d3.scale.ordinal();
  var svg;

  Math.radians = function(degrees) {
    return degrees * Math.PI / 180;
  };
  Math.degrees = function(radians) {
    return radians * 180 / Math.PI;
  };

  var exports = function (_selection) {
    _selection.each(function(_data) {
      if(!svg) {
        d3.select(this).style('width', attrs.width + 'px')
          .style('height', attrs.height + 'px')
        innerWidth = attrs.width - margin.left - margin.right;
        innerHeight = attrs.height - margin.top - margin.bottom;
        netRadius = innerWidth*.5*.75;
        maxRadius = innerWidth*.5*.95;
        minRadius = innerWidth*.5*.45;
        sortRadius.rangeRoundPoints(attrs.sortAscending ? [minRadius, maxRadius] : [maxRadius, minRadius]);
        svg = d3.select(this).append('svg')
          .attr('width', attrs.width)
          .attr('height', attrs.height)
          .append('g')
          .attr('transform', d3.svg.transform().translate([margin.left, margin.top]))

        svg.append('g')
          .attr('class', 'background')
      }
      var colorExtent = d3.set(_data.nodes.map(function(d){return d[attrs.colorKey]})).values();
      color.domain(colorExtent);
      size.domain([attrs.degreeMin,attrs.degreeMax])
        .rangeRound([innerWidth*.005, innerWidth*.1]);
      svg.datum(_data)
        .call(netInit)
      svg.on('click', function() {
        exports.sort();
      })
    })
  }

  function trimValForSort (d) {
    return Math.floor((d.linkToEgo[attrs.sortKey])/attrs.sortUnit) * attrs.sortUnit
  }

  function netInit(_selection) {
    _selection.each(function(_data) {
      var selection = d3.select(this);
      var egoAndNeighbors = getEgoAndNeighbors(_data);
      if (attrs.sortType == 'number') {
          var sortExtent = d3.extent(egoAndNeighbors.neighbors, function(d) {return trimValForSort(d);})
          sortRadius.domain(d3.range(sortExtent[0], sortExtent[1]+attrs.sortUnit, attrs.sortUnit))
      } else {
          var domain = [];
          egoAndNeighbors.neighbors.forEach(function(d){
            if (domain.indexOf(d.linkToEgo[attrs.sortKey]) < 0) {
                domain.push(d.linkToEgo[attrs.sortKey]);
            }
          })
          sortRadius.domain(domain);
      }
      selection.call(drawNeighbors, egoAndNeighbors.neighbors)
        .call(drawEgo, egoAndNeighbors.ego);
    })
    return _selection;
  }

  function getEgoAndNeighbors(_data) {
    var getNeighbors = function (_data, egoIndex, egoNeighbors) {

      //FIXME linkToNeighbors 구할때는 neighbors 영역 안에 있는 것만 구한다.
      var neighbors = [], links = _data.links, nodes = _data.nodes;

      links.forEach(function(l) {
        if (egoIndex === l.source) {
          var neighbor = findNode(nodes, l.target)
          if (neighbor[attrs.nameKey] !== '-') { // 공식 계정은 걸러내기
            if (!egoNeighbors) {
              if (l.is_mutual) l.type = 'mutual'
              else l.type = 'follow'
              neighbors.push({neighbor:neighbor, linkToEgo:l, neighborIndex:l.target})
            } else {
              var egoNeighbor = findNode(egoNeighbors, neighbor[attrs.nodeKey])
              if (egoNeighbor) neighbors.push({linkToEgo:l, neighbor:egoNeighbor})
            }
          }
        } else if (egoIndex === l.target) {
          var neighbor = findNode(nodes, l.source)
          if (neighbor[attrs.nameKey] !== '-') { // 공식 계정은 걸러내기
            if((attrs.isDirected && !l.is_mutual)) {
                if(!egoNeighbors) {
                  l.type = 'followed_by'
                  neighbors.push({neighbor:neighbor, linkToEgo:l, neighborIndex:l.source})
                } else {
                  var egoNeighbor = findNode(egoNeighbors, neighbor[attrs.nodeKey])
                  if (egoNeighbor) neighbors.push({linkToEgo:l, neighbor:egoNeighbor})
                }
            }
          }
        }
      })
      neighbors = neighbors.sort(function(a,b){return a.neighbor[attrs.colorKey].localeCompare(b.neighbor[attrs.colorKey])});
      return neighbors;
    }
    var egoData = findNode(_data.nodes, attrs.egoIndex)//_data.nodes[attrs.egoIndex]
    var neighborsData = getNeighbors(_data, attrs.egoIndex)

    neighborsData.forEach(function(a) {
      a.linkToNeighbors = getNeighbors(_data, a.neighbor[attrs.nodeKey], neighborsData.map(function(d){return d.neighbor})).map(function(d){return d.linkToEgo});
    });

    if(attrs.valueKey) {
      egoData.egoDegree = 0;
      neighborsData.forEach(function(n) {
        egoData.egoDegree += n.linkToEgo[attrs.valueKey]
      })
    } else {
      egoData.egoDegree = neighborsData.length;
    }
    return {ego:egoData, neighbors:neighborsData}
  }

  function findNode(nodes, value) {
    for (var i = 0; i < nodes.length ; i++) {
      if (nodes[i][attrs.nodeKey] == value) {
        return nodes[i];
      }
    }
    return null;
  }

  function drawEgo(selection, egoData) {
    var ego = selection.selectAll('.ego')
      .data([egoData], function(d){return attrs.egoIndex})

    ego.enter().append('g')
      .attr('class', 'ego node new')
      .append('circle')

    selection.selectAll('.ego.new')
      .append('text')
    selection.selectAll('.ego.new')
      .classed({'new':false})

    ego.attr('transform', d3.svg.transform()
      .translate([innerWidth/2, innerHeight/2]
      ))
      .selectAll('circle')
      .attr('r', function(d){return size(d.egoDegree)})
    ego.selectAll('text')
      .attr('text-anchor', 'middle')
      .attr('dy', '.45em')
      .text(function(d){return d[attrs.nameKey]})
    ego.exit()
      .classed({'ego':false, 'neighbor':true})

    return selection;
  }

  function drawNeighbors(selection, neighborsData) {
    var thetaUnit = Math.PI*2/ neighborsData.length,
      thetaOffset = thetaUnit *.3
    var two_pi = Math.PI*2, half_pi = Math.PI*.5;

    var background = selection.select('.background')
      .selectAll('.background-circle')
        .data(function(d){
          return sorted ? d3.zip(sortRadius.range(), sortRadius.domain())
            : [[netRadius]]},
          function(d){return d[0]});

    var backgroundEnter = background.enter().append('g')
      .attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
      .attr('class', 'background-circle')
    //zip
    var circle = backgroundEnter.append('circle')
        .attr('r', 0)

      circle.transition().duration(durationUnit)
        .attr('r', function(d){return d[0]})

    if (sorted) {
      var text = background.selectAll('text')
        .data(function(d){return [d]})
      .enter().append('text')
        .attr('text-anchor','end')
        .text(function(d){return d[1]})
        .style('opacity', 0)
        .attr('x', 0)
        .attr('dx', '-.45em')
        .attr('dy', '.35em')

      text.transition().duration(durationUnit)
        .style('opacity', 1)
        .attr('x', function(d){return d[0]})

    } else {
      background.selectAll('text')
        .remove();
    }

    background.transition()
      .duration(durationUnit)
      .attr('r', function(d){return d})

    background.exit().remove();

    var neighborFunc = function(selection, neighbors, callback) {
      selection.each(function(d) {
        if ('linkToNeighbors' in d) {
          d.linkToNeighbors.forEach(function(l) {
            neighbors.filter(function(n) {
              return ((l.source == n.neighborIndex || l.target == n.neighborIndex)
                && (n.neighborIndex !== d.neighborIndex))
            }).each(callback)
          })
        }
      })
    }
    var setNeighborPos = function(selection) {
      selection.each(function(d) {
        /*
        d3.select(this).call(neighborFunc, neighbors, function(n) {
              if(n.theta - d.theta <= Math.PI) {
                //FIXME : 링크 value를 곱해주기
                d.theta += thetaOffset;
                n.theta -= thetaOffset;
              } else {
                d.theta -= thetaOffset;
                n.theta += thetaOffset;
              }
          });
          */
          var sortVal = d.linkToEgo[attrs.sortKey];
          var radius = (sorted ? sortRadius(attrs.sortType=== 'number'?  trimValForSort(sortVal): sortVal) : netRadius);

          d.x = innerWidth*.5+Math.cos(d.theta)*radius;
          d.y = innerHeight*.5+Math.sin(d.theta)*radius;
      })
      return selection;
    }

    var neighbors = selection.selectAll('.neighbor')
      .data(neighborsData, function(d){return d.neighborIndex})

    var neighborsEnter = neighbors.enter().append('g')
      .attr('class', 'neighbor node')
      .each(function(d) {d.x = innerWidth*.5; d.y = innerHeight*.5})
      .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))
      .call(setNeighborInteraction)

    neighborsEnter.append('circle');
    neighborsEnter.append('text')

    neighbors.each(function(d,i) {
      d.theta = thetaUnit*i;
    }).call(setNeighborPos)
    .transition().delay(durationUnit*.5).duration(durationUnit)
    .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    neighbors.selectAll('circle')
      .attr('r', function(d){return attrs.valueKey && d.linkToEgo[attrs.valueKey] ? size(d.linkToEgo[attrs.valueKey]) : 4})
      .style('fill', function(d){return color(d.neighbor[attrs.colorKey]);})

    neighbors.selectAll('text')
      .attr('text-anchor', function(d) {
        return (d.theta + half_pi)%two_pi > Math.PI ? 'end' : 'start';
      }).attr('transform', d3.svg.transform().rotate(function(d){
        return (d.theta + half_pi)%two_pi > Math.PI ?   Math.degrees(d.theta) + 180 : Math.degrees(d.theta);
        }).translate(function(d) {
          var dx = size(attrs.valueKey ? d.linkToEgo : 1) + 2;
          return [(d.theta + half_pi)%two_pi > Math.PI ? -dx : dx, 0]
        }))
      .attr('dy', '.35em')
      .text(function(d) {return d.neighbor[attrs.nameKey]})

    var linkRadius = d3.scale.linear()
      .domain([0, half_pi])

    var linkLine = d3.svg.line()
      //.interpolate('cardinal')
      //.tension(1)
      .x(function(d) { return d.x; })
      .y(function(d) { return d.y; });

    var linkData = []
    neighbors.each(function(d){
      var self = d3.select(this);
      self.call(neighborFunc, neighbors, function(n) {
        // d-n
        var distTheta = (Math.abs(n.theta-d.theta)%(two_pi));
        if (distTheta <= half_pi) {
          var meanTheta = distTheta*.5 + d.theta;
          if (sorted) {
            var sortValA = d.linkToEgo[attrs.sortKey], sortValB = n.linkToEgo[attrs.sortKey];
            linkRadius.range(
              attrs.sortType === 'number' ? [sortRadius(trimValForSort(sortValA)), sortRadius(trimValForSort(sortValB))] : [sortRadius(sortValA), sortRadius(sortValB)]
            )
          } else {
            linkRadius.range([netRadius*.5, netRadius])
          }
          var r = linkRadius(meanTheta%Math.PI);
          var center = {x: Math.cos(meanTheta)*r + innerWidth*.5
            , y: Math.sin(meanTheta)*r + innerHeight*.5}
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
          //linkData.push([{node:d, x:d.x, y:d.y}, center, {node:n, x:n.x, y:n.y}])
        } else {
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
        }
      });
    })

    /*
    var link = selection.selectAll('.link')
      .data(linkData, function(d){return d[0].node.neighbor[attrs.nodeKey] + '-' +d[d.length-1].node.neighbor[attrs.nodeKey]})

    link.enter().append('path')
      .attr('class', 'link')

    link.transition().delay(durationUnit*.5).duration(durationUnit)
      .attr('d', linkLine);
    link.exit().remove();
    */
    return selection;
  }

  function setNeighborInteraction(_selection) {
    function _isNeighbor(index, linkToNeighbors) {
      for (var i = 0 ; i < linkToNeighbors.length; i++) {
        if (index === linkToNeighbors[i].source || index === linkToNeighbors[i].target) {
          return true;
        }
      }
      return false;
    }

    _selection.on('mouseenter.neighbor', function(d){
      d3.select(this).classed({'hover': true})
      var curIndex = d.neighbor[attrs.nodeKey]
      var linkToNeighbors = d.linkToNeighbors;
      var neighbors = d3.select(d3.select(this).node().parentNode)
        .selectAll('.neighbor')
        .filter(function(n) {
          var index = n.neighbor[attrs.nodeKey];
          if (index !== curIndex) return _isNeighbor(index, linkToNeighbors);
          return false;
        }).classed({'hover':true})
      //TODO : find neighbors who are not in the network
    }).on('mouseleave', function() {
      d3.select(d3.select(this).node().parentNode)
        .selectAll('.neighbor.hover').classed({'hover': false})
    }).on('click.neighbor', function(d) {
      d3.event.stopPropagation();
    })
  }

  function packageHierarchy(nodes) {

  }

  function accessor(_attr) {
    return function(value) {
      if(value === undefined) return attrs[_attr]
      attrs[_attr] = value;
      return exports;
    }
  }

  exports['sort'] = function (sortKey) {
    if (sortKey !== undefined) {
      attrs.sortKey = 'sortKey';
    }

    sorted = !sorted;
    svg.call(netInit);
    //sort;
    return exports;
  }


  for (var attr in attrs) {
    if(attrs.hasOwnProperty(attr)) {
      exports[attr] = accessor(attr);
    }
  }

  return exports;
}
