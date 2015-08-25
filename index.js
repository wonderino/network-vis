d3.egoNetworks = function module() {
  var attrs = {
    width: 400,
    height:400,
    egoIndex:0,
    degreeMin:1,
    degreeMax:10,
    sortKey:'value',
    sortAscending : false,
    sortUnit : 1
  }
  var margin = {top:20, right:20, bottom:20, left:20}
  var debug = false, sorted = false, durationUnit = 400;
  var size = d3.scale.linear();
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
      size.domain([attrs.degreeMin,attrs.degreeMax])
        .rangeRound([innerWidth*.01, innerWidth*.1]);
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
      var egoData = getCurEgo(_data.nodes),
      neighborsData = getNeighbors(_data);
      egoData.egoIndex = attrs.egoIndex;
      egoData.egoDegree = neighborsData.reduce(function(pre, cur){
        return pre + cur.linkToEgo.value
      },0)

      neighborsData.forEach(function(d,i) {
        d.linkToNeighbors = []
        neighborsData.forEach(function(n,j) {
          if (j>i) {
            var filtered = _data.links.filter(function(l) {
              return (l.source === d.neighborIndex && l.target === n.neighborIndex)
                || (l.target === d.neighborIndex && l.source === n.neighborIndex)
            })
            d.linkToNeighbors = d.linkToNeighbors.concat(filtered); // 한쪽에만 링크를 두어서 루프 최소화
          }
        })
      })

      var sortExtent = d3.extent(neighborsData, function(d) {return trimValForSort(d);})
      sortRadius.domain(d3.range(sortExtent[0], sortExtent[1]+attrs.sortUnit, attrs.sortUnit))
      selection.call(drawNeighbors, neighborsData)
        .call(drawEgo, egoData);
    })
    return _selection;
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
      .text(function(d){return d.name})
    ego.exit()
      .classed({'ego':false, 'neighbor':true})

    return selection;
  }

  function drawNeighbors(selection, neighborsData) {
    var thetaUnit = Math.PI*2 / neighborsData.length,
      thetaOffset = thetaUnit *.3
    var two_pi = Math.PI*2, half_pi = Math.PI*.5;

    var background = selection.select('.background').selectAll('circle')
        .data(function(){return sorted ? sortRadius.range(): [netRadius]}, function(d,i){return i})

    background.enter().append('circle')
      .attr('transform', d3.svg.transform().translate([innerWidth/2, innerHeight/2]))
      .attr('r', netRadius)

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
                && n.neighborIndex !== d.neighborIndex)
            }).each(callback)
          })
        }
      })
    }
    var setNeighborPos = function(selection) {
      selection.each(function(d) {
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
          var radius = (sorted ? sortRadius(trimValForSort(d)) : netRadius);
          d.x = innerWidth*.5+Math.cos(d.theta)*radius;
          d.y = innerHeight*.5+Math.sin(d.theta)*radius;
      })
      return selection;
    }

    var neighbors = selection.selectAll('.neighbor')
      .data(neighborsData, function(d){return d.neighborIndex})

    neighbors.enter().append('g')
      .attr('class', 'neighbor node new')
      .each(function(d) {d.x = innerWidth*.5; d.y = innerHeight*.5})
      .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    selection.selectAll('.neighbor.new')
      .append('circle')
    selection.selectAll('.neighbor.new')
      .append('text')
    selection.selectAll('.neighbor.new')
      .classed({'new':false})

    neighbors.each(function(d,i) {
      d.theta = thetaUnit*i;
    }).call(setNeighborPos)
    .transition().delay(durationUnit*.5).duration(durationUnit)
    .attr('transform', d3.svg.transform().translate(function(d,i) {return [d.x, d.y] }))

    neighbors.selectAll('circle')
      .attr('r', function(d){return size(d.linkToEgo.value)})

    neighbors.selectAll('text')
      .attr('text-anchor', function(d) {
        return d.theta > Math.PI ? 'end' : 'start';
      }).attr('transform', d3.svg.transform().rotate(function(d){
        return d.theta > Math.PI ? d.theta/Math.PI*180 + 180 :d.theta/Math.PI*180;
      }).translate(function(d) {
        var dx = size(d.linkToEgo.value) + 2;
        return [d.theta > Math.PI ? -dx : dx, 0]
      })).attr('dy', '.35em')
      .text(function(d) {return d.neighbor.name})

    var linkRadius = d3.scale.linear()
      .domain([0, half_pi])

    var linkLine = d3.svg.line()
      .interpolate('cardinal')
      .tension(0)
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
            linkRadius.range([sortRadius(trimValForSort(d)), sortRadius(trimValForSort(n))])
          } else {
            linkRadius.range([netRadius*.5, netRadius])
          }
          var r = linkRadius(meanTheta%Math.PI);
          var center = {x: Math.cos(meanTheta)*r + innerWidth*.5
            , y: Math.sin(meanTheta)*r + innerHeight*.5}
          linkData.push([{node:d, x:d.x, y:d.y}, center, {node:n, x:n.x, y:n.y}])
        } else {
          linkData.push([{node:d, x:d.x, y:d.y}, {node:n, x:n.x, y:n.y}])
        }
      });
    })

    var link = selection.selectAll('.link')
      .data(linkData, function(d){return d[0].node.neighbor.name + '-' +d[d.length-1].node.neighbor.name})

    link.enter().append('path')
      .attr('class', 'link')

    link.transition().delay(durationUnit*.5).duration(durationUnit)
      .attr('d', linkLine);
    link.exit().remove();

    return selection;
  }

  function getNeighbors(_data) {
    var neighbors = []
    _data.links.forEach(function(l,i) {
      if (attrs.egoIndex === l.source) {
        neighbors.push({neighbor:_data.nodes[l.target], linkToEgo:l, neighborIndex:l.target})
      } else if (attrs.egoIndex === l.target) {
        neighbors.push({neighbor:_data.nodes[l.source], linkToEgo:l, neighborIndex:l.source})
      }
    })
    return neighbors;
  }

  function getCurEgo(nodes) {
    return nodes[attrs.egoIndex]
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
